// @vitest-environment node
// vercel.json con el mismo compilador de rutas que usa Vercel (@vercel/routing-utils): qué
// recibe cada URL una vez que no es un archivo estático ni una función.
import { readFileSync } from "node:fs";
import { getTransformedRoutes } from "@vercel/routing-utils";
import middleware, { config as middlewareConfig } from "../../middleware";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const { routes, error } = getTransformedRoutes({ rewrites: vercel.rewrites, headers: vercel.headers });
const all = (routes ?? []) as { src?: string; dest?: string; handle?: string; headers?: Record<string, string> }[];
const fs = all.findIndex((r) => r.handle === "filesystem");
const rewrites = all.slice(fs + 1).filter((r) => r.src && r.dest);
const headerRules = all.slice(0, fs).filter((r) => r.src && r.headers);

/** Destino del primer rewrite que coincide (lo que pasa cuando no hay archivo con ese nombre). */
function rewrite(path: string): string | undefined {
  for (const r of rewrites) {
    const m = new RegExp(r.src!).exec(path);
    if (m) return r.dest!.replace(/\$(\d+)/g, (_, i: string) => m[Number(i)] ?? "");
  }
  return undefined;
}
const headersFor = (path: string) => Object.assign({}, ...headerRules.filter((r) => new RegExp(r.src!).test(path)).map((r) => r.headers));

it("vercel.json compila sin errores", () => {
  expect(error).toBeNull();
  expect(fs).toBeGreaterThan(-1);
});

describe("pantallas de la app (SPA)", () => {
  // Cada `path` de appRoutes en App.tsx, con parámetros de ejemplo, en español y en inglés.
  const app = readFileSync("src/App.tsx", "utf8");
  const paths = [...app.matchAll(/\{ path: "([^"*]+)", element/g)].map((m) => `/${m[1]!.replace(/:[a-zA-Z]+/g, "x1")}`);

  it("encuentra las rutas de App.tsx", () => {
    expect(paths).toContain("/account");
    expect(paths).toContain("/plans/x1/edit");
    expect(paths.length).toBeGreaterThan(20);
  });

  it("ninguna pantalla de la app cae en el 404", () => {
    for (const path of paths.flatMap((p) => [p, `/en${p}`])) {
      expect(rewrite(path), path).toBeDefined();
      expect(rewrite(path), path).not.toMatch(/type=404/);
    }
  });

  it("las pantallas sin versión en el servidor sirven el shell", () => {
    for (const path of ["/account", "/en/search", "/plans/new", "/plans/abc/edit", "/groups/g1", "/join/g1", "/wrapped/2025", "/f/marvel/timeline", "/en/f/marvel/prep/x"]) {
      // Vercel agrega los parámetros con nombre como query; al archivo estático le da igual.
      expect(rewrite(path)?.split("?")[0], path).toBe("/index.html");
    }
  });
});

describe("páginas del servidor", () => {
  it.each([
    ["/about", "/api/page?type=about"],
    ["/en/contact", "/api/page?type=contact&lang=en"],
    ["/privacy", "/api/page?type=privacy"],
    ["/en/terms", "/api/page?type=terms&lang=en"],
    ["/developers", "/api/page?type=developers"],
    ["/f/marvel", "/api/page?type=f&id=marvel"],
    ["/openapi.json", "/api/page?type=openapi"],
    ["/llms.txt", "/api/page?type=llms"],
  ])("%s → %s", (path, dest) => {
    expect(rewrite(path)).toBe(dest);
  });

  it("la API del catálogo va a api/page.ts", () => {
    expect(rewrite("/api/franchises")).toBe("/api/page?type=api&resource=franchises");
    expect(rewrite("/api/franchises/marvel")).toBe("/api/page?type=api&resource=franchises&id=marvel");
    expect(rewrite("/api/titles/saw-2004")).toBe("/api/page?type=api&resource=titles&id=saw-2004");
  });
});

describe("404", () => {
  it("una ruta desconocida va al 404 del servidor, no al shell con 200", () => {
    expect(rewrite("/some-path-that-does-not-exist")).toBe("/api/page?type=404&path=some-path-that-does-not-exist");
    expect(rewrite("/en/nope/deeper")).toBe("/api/page?type=404&path=en/nope/deeper");
  });

  it("un /api/… desconocido va al 404 en JSON", () => {
    expect(rewrite("/api/nope")).toBe("/api/page?type=api-404&path=nope");
    expect(rewrite("/api/a/b")).toBe("/api/page?type=api-404&path=a/b");
  });
});

describe("encabezados", () => {
  it("noindex en las pantallas privadas, con y sin /en", () => {
    for (const path of ["/account", "/en/account", "/plans/abc", "/search"]) expect(headersFor(path)["X-Robots-Tag"], path).toBe("noindex");
    for (const path of ["/", "/f/marvel", "/about"]) expect(headersFor(path)["X-Robots-Tag"], path).toBeUndefined();
  });

  it("la portada estática dice que varía según Accept y enlaza llms.txt y OpenAPI", () => {
    const h = headersFor("/");
    expect(h.Vary).toBe("Accept");
    expect(h.Link).toContain('</openapi.json>; rel="service-desc"');
    expect(headersFor("/about").Vary).toBeUndefined();
  });
});

describe("middleware.ts (solo la portada)", () => {
  const run = (accept?: string) => middleware(new Request("https://watchlist.wxlter.dev/", { headers: accept ? { Accept: accept } : {} }));

  it("solo corre en /", () => {
    expect(middlewareConfig.matcher).toBe("/");
  });

  it("un navegador sigue al index.html estático", () => {
    expect(run("text/html,*/*;q=0.8").headers.get("x-middleware-next")).toBe("1");
    expect(run().headers.get("x-middleware-next")).toBe("1");
  });

  it("Markdown (o nada aceptable) se reescribe a la portada de api/page.ts", () => {
    expect(run("text/markdown").headers.get("x-middleware-rewrite")).toBe("https://watchlist.wxlter.dev/api/page?type=home");
    expect(run("application/json").headers.get("x-middleware-rewrite")).toBe("https://watchlist.wxlter.dev/api/page?type=home");
  });
});

describe("API versionada (/api/v1)", () => {
  it.each([
    ["/api/v1/franchises", "/api/page?type=api&resource=franchises"],
    ["/api/v1/franchises/marvel", "/api/page?type=api&resource=franchises&id=marvel"],
    ["/api/v1/titles/saw-2004", "/api/page?type=api&resource=titles&id=saw-2004"],
    ["/api/v1/openapi.json", "/api/page?type=openapi"],
    ["/api/v1/health", "/api/log"],
    ["/api/v1/upcoming", "/api/upcoming"],
    ["/api/v1/providers", "/api/providers"],
    ["/api/v1/credits", "/api/credits"],
  ])("%s → %s", (path, dest) => {
    expect(rewrite(path)).toBe(dest);
  });

  it("una versión o endpoint que no existe es 404 en JSON", () => {
    expect(rewrite("/api/v2/franchises")).toMatch(/type=api-404/);
    expect(rewrite("/api/v1/nope")).toMatch(/type=api-404/);
  });
});
