// @vitest-environment node
// El CLI sin red: un fetch falso devuelve las respuestas de la API.
import { ApiError, parseArgs, plan, request, run, UsageError, VERSION } from "./src/index.mjs";

const sink = () => ({ text: "", write(s) { this.text += s; } });
const reply = (body, init = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init });

async function exec(argv, fetchImpl, env = {}) {
  const stdout = sink();
  const stderr = sink();
  const code = await run(argv, { stdout, stderr, fetch: fetchImpl, env });
  return { code, out: stdout.text, err: stderr.text };
}

describe("watch-order CLI", () => {
  it("parseArgs separa banderas y posicionales", () => {
    expect(parseArgs(["order", "marvel", "--order", "chronological", "--lang=es", "--json"])).toEqual({
      flags: { order: "chronological", lang: "es", json: true },
      positional: ["order", "marvel"],
    });
    expect(() => parseArgs(["order", "--order"])).toThrow(UsageError);
  });

  it("plan arma la ruta /api/v1 de cada comando", () => {
    expect(plan("franchises", [], {})).toMatchObject({ path: "/franchises" });
    expect(plan("order", ["marvel"], { order: "chronological", lang: "es" })).toMatchObject({ path: "/franchises/marvel", params: { order: "chronological", lang: "es" } });
    expect(plan("providers", ["299534", "movie"], { region: "US" })).toMatchObject({ path: "/providers", params: { tmdbId: "299534", type: "movie", region: "US" } });
    expect(() => plan("credits", ["1", "film"], {})).toThrow("movie or tv");
    expect(() => plan("order", [], {})).toThrow("Usage");
    expect(() => plan("nope", [], {})).toThrow("Unknown command");
    expect(() => plan("franchises", [], { lang: "fr" })).toThrow("--lang");
  });

  it("franchises: pide /api/v1/franchises y lista las franquicias", async () => {
    const fetchImpl = vi.fn(async () => reply({ count: 1, franchises: [{ id: "marvel", name: "Marvel", titleCount: 40 }] }));
    const { code, out } = await exec(["franchises", "--lang", "es"], fetchImpl);
    expect(code).toBe(0);
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://watchlist.wxlter.dev/api/v1/franchises?lang=es");
    expect(out).toContain("marvel");
    expect(out).toContain("40 titles");
  });

  it("--json imprime la respuesta tal cual y --base-url / $WATCH_ORDER_URL cambian el origen", async () => {
    const body = { ok: true, time: "2026-01-01T00:00:00Z" };
    const fetchImpl = vi.fn(async () => reply(body));
    const first = await exec(["health", "--json", "--base-url", "http://localhost:5173"], fetchImpl);
    expect(JSON.parse(first.out)).toEqual(body);
    expect(String(fetchImpl.mock.calls[0][0])).toBe("http://localhost:5173/api/v1/health");
    await exec(["health"], fetchImpl, { WATCH_ORDER_URL: "http://example.test" });
    expect(String(fetchImpl.mock.calls[1][0])).toBe("http://example.test/api/v1/health");
  });

  it("errores de la API: código 1 con el mensaje y el hint", async () => {
    const fetchImpl = async () => reply({ error: "No existe", hint: "List valid ids with GET /api/v1/franchises." }, { status: 404 });
    const { code, err } = await exec(["order", "marvl"], fetchImpl);
    expect(code).toBe(1);
    expect(err).toContain("Error 404: No existe");
    expect(err).toContain("List valid ids");
  });

  it("uso incorrecto: código 2; ayuda y versión: código 0", async () => {
    expect((await exec(["title"], vi.fn())).code).toBe(2);
    expect((await exec(["--help"], vi.fn())).out).toContain("Usage: watch-order");
    expect((await exec([], vi.fn())).code).toBe(0);
    expect((await exec(["--version"], vi.fn())).out.trim()).toBe(VERSION);
  });

  it("429: espera Retry-After y reintenta una vez", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(reply({ error: "slow down" }, { status: 429, headers: { "Retry-After": "2", "Content-Type": "application/json" } }))
        .mockResolvedValueOnce(reply({ ok: true }));
      const pending = request("https://watchlist.wxlter.dev", "/health", {}, fetchImpl);
      await vi.advanceTimersByTimeAsync(2_000);
      await expect(pending).resolves.toEqual({ ok: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("un segundo 429 se reporta como ApiError", async () => {
    vi.useFakeTimers();
    try {
      const limited = () => reply({ error: "slow down" }, { status: 429, headers: { "Retry-After": "1", "Content-Type": "application/json" } });
      const pending = request("https://watchlist.wxlter.dev", "/health", {}, vi.fn(async () => limited()));
      const assertion = expect(pending).rejects.toBeInstanceOf(ApiError);
      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
