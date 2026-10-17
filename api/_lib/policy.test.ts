// @vitest-environment node
import { headOf, consume, deprecationHeaders, RATE_LIMIT, resetRateLimits, withPolicy } from "./policy";

const from = (ip: string) => new Request("https://watchlist.wxlter.dev/api/v1/franchises", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
beforeEach(() => resetRateLimits());

describe("consume", () => {
  it("cuenta por cliente y avisa al pasar el límite", () => {
    const now = 1_000_000;
    for (let i = 1; i <= RATE_LIMIT; i++) expect(consume(from("203.0.113.1"), now)).toMatchObject({ limited: false, remaining: RATE_LIMIT - i });
    expect(consume(from("203.0.113.1"), now)).toMatchObject({ limited: true, remaining: 0 });
    expect(consume(from("203.0.113.2"), now).limited).toBe(false);
  });

  it("la ventana se reinicia y reset va de 1 al tamaño de la ventana", () => {
    const now = 5_000_000;
    for (let i = 0; i <= RATE_LIMIT; i++) consume(from("203.0.113.3"), now);
    expect(consume(from("203.0.113.3"), now + 59_999)).toMatchObject({ limited: true, reset: 1 });
    expect(consume(from("203.0.113.3"), now + 60_000)).toMatchObject({ limited: false, remaining: RATE_LIMIT - 1, reset: 60 });
  });
});

describe("withPolicy", () => {
  it("añade las cabeceras a una respuesta normal y conserva status, cuerpo y caché", async () => {
    const res = await withPolicy(from("203.0.113.4"), () => new Response("ok", { status: 201, headers: { "Cache-Control": "public, s-maxage=60" } }));
    expect(res.status).toBe(201);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=60");
    expect(res.headers.get("ratelimit-policy")).toBe('"default";q=60;w=60');
    expect(res.headers.get("api-version")).toBe("v1");
  });

  it("no llama al handler cuando ya se pasó del límite", async () => {
    const handler = vi.fn(() => new Response("ok"));
    for (let i = 0; i < RATE_LIMIT; i++) await withPolicy(from("203.0.113.5"), handler);
    const res = await withPolicy(from("203.0.113.5"), handler);
    expect(handler).toHaveBeenCalledTimes(RATE_LIMIT);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toMatch(/^\d+$/);
  });
});

describe("deprecationHeaders", () => {
  it("Deprecation como fecha estructurada (RFC 9745), Sunset HTTP-date (RFC 8594) y Link al sucesor", () => {
    const h = deprecationHeaders(new Date("2027-01-01T00:00:00Z"), new Date("2027-07-01T00:00:00Z"), "/api/v2/franchises");
    expect(h.Deprecation).toBe("@1798761600");
    expect(h.Sunset).toBe("Thu, 01 Jul 2027 00:00:00 GMT");
    expect(h.Link).toBe('</api/v2/franchises>; rel="successor-version"');
  });
});

describe("headOf", () => {
  it("devuelve status y cabeceras del GET sin cuerpo", async () => {
    const head = headOf((r) => withPolicy(r, () => new Response("cuerpo", { status: 200, headers: { "X-Test": "1" } })));
    const res = await head(from("203.0.113.6"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-test")).toBe("1");
    expect(res.headers.get("ratelimit-policy")).toBe('"default";q=60;w=60');
    expect(await res.text()).toBe("");
  });
});
