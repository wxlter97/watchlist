// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { GET } from "../page";

// api/page.ts pide el index.html del build a su propio origen: aquí, el de la raíz del repo.
const shell = readFileSync("index.html", "utf8");
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => (String(input).endsWith("/index.html") ? new Response(shell) : new Response("", { status: 404 }))),
  );
});
afterEach(() => vi.unstubAllGlobals());

const ORIGIN = "https://watchlist.wxlter.dev";
const get = (query: string, accept?: string) =>
  GET(new Request(`${ORIGIN}/api/page?${query}`, { headers: accept ? { Accept: accept } : {} }));
const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

/** El texto visible sin JavaScript: lo que va dentro de <main>, sin etiquetas. */
function mainText(html: string): string {
  const main = /<main[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1] ?? "";
  return main.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("negociación de Markdown en las páginas", () => {
  it("la portada en Markdown: text/markdown, Vary: Accept, un H1 y más de 500 caracteres", async () => {
    const res = await get("type=home", "text/markdown");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toBe("Accept");
    const md = await res.text();
    expect(md.startsWith("# Watch Order")).toBe(true);
    expect(md.length).toBeGreaterThan(500);
    expect(md).toContain(`[Marvel](${ORIGIN}/f/marvel)`);
    expect(md).toContain(`(${ORIGIN}/developers)`);
  });

  it("la misma página para un navegador es HTML, también con Vary: Accept", async () => {
    const res = await get("type=home&lang=en", BROWSER);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("vary")).toBe("Accept");
    const html = await res.text();
    expect(html).toContain('<html lang="en">');
    expect(mainText(html).length).toBeGreaterThan(500);
  });

  it("una franquicia en Markdown lista sus títulos", async () => {
    const md = await (await get("type=f&id=saw", "text/markdown")).text();
    expect(md).toMatch(/^# Saw\n/);
    expect(md).toMatch(/\n1\. \[/);
  });

  it("406 si no acepta HTML ni Markdown", async () => {
    const res = await get("type=faq", "application/json");
    expect(res.status).toBe(406);
    expect(res.headers.get("vary")).toBe("Accept");
  });
});

describe("404 de verdad", () => {
  it("una ruta que la app no tiene: 404 con noindex y el shell de la app", async () => {
    const res = await get("type=404&path=no-existe/aqui", BROWSER);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('<div id="root">');
    expect(html).not.toContain('id="shell-home"');
    expect(mainText(html)).toContain("/no-existe/aqui");
  });

  it("en Markdown: 404, text/markdown y adónde ir (sitemap, llms.txt, docs)", async () => {
    const res = await get("type=404&path=en/nope", "text/markdown");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const md = await res.text();
    expect(md).toMatch(/^# We couldn't find this page/);
    expect(md).toContain("/en/nope");
    for (const link of ["/sitemap.xml", "/llms.txt", "/developers"]) expect(md).toContain(`(${ORIGIN}${link})`);
  });

  it("un id de franquicia o título que no existe es 404 con su ruta pública", async () => {
    const res = await get("type=f&id=no-existe", "text/markdown");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("/f/no-existe");
    expect((await get("type=t&id=no-existe&lang=en")).status).toBe(404);
  });

  it("aun con un Accept raro, un 404 sigue siendo 404 (no 406)", async () => {
    expect((await get("type=404&path=x", "application/json")).status).toBe(404);
  });
});

describe("páginas de confianza (sin JavaScript)", () => {
  for (const type of ["about", "contact", "privacy", "terms", "developers"]) {
    for (const lang of ["es", "en"]) {
      it(`/${lang === "en" ? "en/" : ""}${type}: 200, un H1 y más de 500 caracteres de texto`, async () => {
        const res = await get(`type=${type}&lang=${lang}`, BROWSER);
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html.match(/<h1>/g)).toHaveLength(1);
        expect(mainText(html).length).toBeGreaterThan(500);
        expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${lang === "en" ? "/en" : ""}/${type}">`);
      });
    }
  }

  it("contacto: el correo como link y Organization con contactPoint", async () => {
    const html = await (await get("type=contact")).text();
    expect(html).toContain('<a href="mailto:work@wxlter.dev">work@wxlter.dev</a>');
    expect(html).toContain('"@type":"ContactPage"');
    expect(html).toContain('"contactPoint"');
  });

  it("la portada lleva el JSON-LD Organization con contactPoint", async () => {
    const html = await (await get("type=home&lang=en")).text();
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
    const org = ld.find((d) => d["@type"] === "Organization");
    expect(org).toMatchObject({ name: "Watch Order", url: `${ORIGIN}/`, contactPoint: [{ "@type": "ContactPoint", email: "work@wxlter.dev", contactType: "customer support" }] });
  });

  it("los encabezados de la guía para desarrolladores no saltan niveles", async () => {
    const md = await (await get("type=developers&lang=en", "text/markdown")).text();
    const levels = [...md.matchAll(/^(#+) /gm)].map((m) => m[1]!.length);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    expect(md).toContain("```\ncurl 'https://watchlist.wxlter.dev/api/franchises/marvel?order=chronological'\n```");
  });
});

describe("archivos para agentes", () => {
  it("llms.txt dice cuándo usar la app y cómo llamar la API", async () => {
    const res = await get("type=llms");
    const txt = await res.text();
    expect(txt).toMatch(/^# Watch Order\n/);
    expect(txt).toContain("## When to use Watch Order");
    expect(txt).toContain(`${ORIGIN}/api/franchises`);
    expect(txt).toContain(`[OpenAPI 3.1 specification](${ORIGIN}/openapi.json)`);
    expect(txt).toContain(`[API documentation](${ORIGIN}/developers)`);
  });

  it("el sitemap incluye las páginas nuevas en ambos idiomas", async () => {
    const xml = await (await get("type=sitemap")).text();
    for (const path of ["/about", "/en/about", "/contact", "/developers", "/en/privacy", "/terms"]) expect(xml).toContain(`<loc>${ORIGIN}${path}</loc>`);
  });

  it("robots.txt deja leer la API pública del catálogo", async () => {
    const txt = await (await get("type=robots")).text();
    expect(txt).toContain("Allow: /api/franchises");
    expect(txt).toContain("Disallow: /api/");
  });
});

describe("API del catálogo", () => {
  const api = async (query: string) => {
    const res = await get(query);
    return { res, body: (await res.json()) as Record<string, any> };
  };

  it("GET /api/franchises: todas, con CORS", async () => {
    const { res, body } = await api("type=api&resource=franchises");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(body.count).toBe(readdirSync("src/data/franchises").length);
    expect(body.franchises.find((f: { id: string }) => f.id === "marvel")).toMatchObject({ name: "Marvel", apiUrl: `${ORIGIN}/api/franchises/marvel`, url: `${ORIGIN}/en/f/marvel` });
  });

  it("GET /api/franchises/{id}?order=: los títulos de ese orden, en orden", async () => {
    const { body } = await api("type=api&resource=franchises&id=saw&order=release&lang=es");
    expect(body.order.id).toBe("release");
    expect(body.url).toBe(`${ORIGIN}/f/saw`);
    const dates = body.order.items.map((i: { releaseDate: string }) => i.releaseDate);
    expect(dates).toEqual([...dates].sort());
    expect(body.order.items[0]).toMatchObject({ position: 1, titleId: expect.any(String), importance: expect.stringMatching(/essential|recommended|optional|skippable/) });
  });

  it("errores en JSON con code, hint y docs", async () => {
    const missing = await api("type=api&resource=franchises&id=marvl");
    expect(missing.res.status).toBe(404);
    expect(missing.res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(missing.body).toEqual({ error: 'No existe la franquicia "marvl"', code: "not_found", status: 404, hint: "List valid ids with GET /api/franchises.", docs: "/developers#errors" });

    const order = await api("type=api&resource=franchises&id=saw&order=nope");
    expect(order.res.status).toBe(400);
    expect(order.body.code).toBe("invalid_request");
    expect(order.body.hint).toContain("release");
  });

  it("GET /api/titles/{id}: ficha y franquicias", async () => {
    const { res, body } = await api("type=api&resource=titles&id=saw-2004");
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: "saw-2004", kind: "movie", tmdbType: "movie", url: `${ORIGIN}/en/t/saw-2004` });
    expect(body.franchises.map((f: { id: string }) => f.id)).toContain("saw");
  });

  it("un /api/… que no existe es 404 en JSON", async () => {
    const { res, body } = await api("type=api-404&path=nope");
    expect(res.status).toBe(404);
    expect(body).toMatchObject({ code: "not_found", error: "No existe el endpoint /api/nope" });
  });
});

describe("OpenAPI", () => {
  const spec = async () => (await (await get("type=openapi")).json()) as Record<string, any>;

  it("es OpenAPI 3.1 con el servidor de producción", async () => {
    const s = await spec();
    expect(s.openapi).toBe("3.1.0");
    expect(s.servers).toEqual([{ url: ORIGIN }]);
    expect(s.info.title).toBe("Watch Order API");
  });

  it("cada operación tiene operationId único, descripción, parámetros tipados y respuestas con schema", async () => {
    const s = await spec();
    const ops = Object.values(s.paths as Record<string, Record<string, any>>).flatMap((p) => Object.values(p));
    const ids = ops.map((o) => o.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const op of ops) {
      expect(op.operationId).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
      expect(op.description.length).toBeGreaterThan(20);
      for (const p of op.parameters ?? []) expect(p.schema?.type).toBeTruthy();
      for (const r of Object.values(op.responses as Record<string, any>)) expect(r.content["application/json"].schema).toBeTruthy();
    }
  });

  it("todas las $ref existen", async () => {
    const s = await spec();
    const refs = [...JSON.stringify(s).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)].map((m) => m[1]!);
    for (const ref of refs) expect(s.components.schemas[ref], ref).toBeTruthy();
  });

  it("documenta los endpoints que existen", async () => {
    const s = await spec();
    expect(Object.keys(s.paths).sort()).toEqual(["/api/credits", "/api/franchises", "/api/franchises/{id}", "/api/health", "/api/providers", "/api/titles/{id}", "/api/upcoming"]);
    for (const file of ["credits", "providers", "upcoming", "log"]) expect(readdirSync("api")).toContain(`${file}.ts`);
  });
});

describe("portada estática (index.html)", () => {
  it("el contenido que se le inyecta al compilar: más de 500 caracteres, todas las franquicias y los links para agentes", async () => {
    const { homeSections } = await import("./seo");
    const html = homeSections("es", { descriptions: false });
    expect(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length).toBeGreaterThan(500);
    for (const file of readdirSync("src/data/franchises")) expect(html).toContain(`href="/f/${file.replace(/\.json$/, "")}"`);
    for (const href of ["/developers", "/about", "/contact", "/llms.txt", "/openapi.json"]) expect(html).toContain(`href="${href}"`);
    // Sin H1 propio (es el del shell) y con encabezados que siguen de él.
    expect(html).not.toContain("<h1");
    expect(html).toContain("<h2>Franquicias</h2>");
  });
});
