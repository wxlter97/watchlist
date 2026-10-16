// API pública de solo lectura del catálogo (sin cuenta ni clave), para integraciones y agentes:
//   GET /api/franchises, /api/franchises/{id}, /api/titles/{id} y la especificación /openapi.json.
// Sale de api/page.ts (vercel.json la reescribe allá): el plan Hobby limita el número de funciones.
import { join } from "node:path";
import { computeOrder } from "../../src/lib/orders.js";
import type { Franchise, Lang, Title } from "../../src/lib/types.js";
import { localize, readData, titleName } from "./catalog.js";
import { franchiseIds, franchisesOfTitle, prefixOf } from "./seo.js";
import { apiError, json } from "./tmdb.js";

export const API_VERSION = "1.0.0";
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CACHE = 3_600;

let fullTitles: Map<string, Title> | undefined;
const titlesMap = () => (fullTitles ??= new Map(readData<Title[]>("titles.json").map((t) => [t.id, t])));
const readFull = (id: string) => readData<Franchise>(join("franchises", `${id}.json`));

const langOf = (url: URL): Lang => (url.searchParams.get("lang") === "es" ? "es" : "en");
const pageUrl = (origin: string, lang: Lang, path: string) => `${origin}${prefixOf(lang)}${path}`;
const poster = (t: Title) => (t.posterPath ? `https://image.tmdb.org/t/p/w500${t.posterPath}` : null);

function franchiseSummary(f: Franchise, lang: Lang, origin: string) {
  return {
    id: f.id,
    name: localize(f.name, lang),
    description: localize(f.description, lang),
    titleCount: new Set(f.entries.map((e) => e.titleId)).size,
    orders: f.orders.map((o) => ({ id: o.id, type: o.type, name: localize(o.name, lang) })),
    routeCount: f.routes.length,
    url: pageUrl(origin, lang, `/f/${f.id}`),
    apiUrl: `${origin}/api/franchises/${f.id}`,
  };
}

function listFranchises(lang: Lang, origin: string): Response {
  const franchises = franchiseIds().map((id) => franchiseSummary(readFull(id), lang, origin));
  return json({ lang, count: franchises.length, franchises }, { maxAge: CACHE, cors: true });
}

function getFranchise(id: string, url: URL, origin: string): Response {
  if (!ID.test(id) || !franchiseIds().includes(id)) return apiError(404, `No existe la franquicia "${id}"`, "List valid ids with GET /api/franchises.");
  const lang = langOf(url);
  const f = readFull(id);
  const orderId = url.searchParams.get("order") ?? f.orders.find((o) => o.type === "release")?.id ?? f.orders[0]!.id;
  const order = f.orders.find((o) => o.id === orderId);
  if (!order) return apiError(400, `order: "${orderId}" no es un orden de ${id}`, `Use one of: ${f.orders.map((o) => o.id).join(", ")}.`);

  const titles = titlesMap();
  const items = computeOrder(f, order, titles).map((x) => ({
    position: x.position,
    titleId: x.title.id,
    ...(x.season !== undefined ? { season: x.season } : {}),
    title: titleName(x.title, lang) + (x.season !== undefined ? ` · ${lang === "es" ? "Temporada" : "Season"} ${x.season}` : ""),
    kind: x.title.kind,
    releaseDate: x.releaseDate,
    importance: x.entry.importance,
    continuityId: x.entry.continuityId,
    ...(x.section ? { section: x.section } : {}),
  }));
  return json(
    {
      lang,
      ...franchiseSummary(f, lang, origin),
      continuities: f.continuities.map((c) => ({
        id: c.id,
        name: localize(c.name, lang),
        canonLevel: c.canonLevel,
        ...(c.hiddenByDefault ? { hiddenByDefault: true } : {}),
      })),
      orders: f.orders.map((o) => ({ id: o.id, type: o.type, name: localize(o.name, lang), description: localize(o.description, lang) })),
      order: { id: order.id, type: order.type, name: localize(order.name, lang), items },
      routes: f.routes.map((r) => ({
        id: r.id,
        kind: r.kind,
        name: localize(r.name, lang),
        description: localize(r.description, lang),
        titleIds: r.titleIds,
        ...(r.targetTitleId ? { targetTitleId: r.targetTitleId } : {}),
        url: pageUrl(origin, lang, `/f/${f.id}/r/${r.id}`),
      })),
    },
    { maxAge: CACHE, cors: true },
  );
}

function getTitle(id: string, url: URL, origin: string): Response {
  const t = ID.test(id) ? titlesMap().get(id) : undefined;
  if (!t) return apiError(404, `No existe el título "${id}"`, "Find title ids in GET /api/franchises/{id} (order.items[].titleId).");
  const lang = langOf(url);
  return json(
    {
      lang,
      id: t.id,
      title: titleName(t, lang),
      originalTitle: t.title,
      kind: t.kind,
      releaseDate: t.releaseDate,
      ...(t.runtimeMin ? { runtimeMin: t.runtimeMin } : {}),
      ...(t.seasons?.length ? { seasons: t.seasons } : {}),
      ...(t.ongoing ? { ongoing: true } : {}),
      overview: t.localized?.[lang]?.overview ?? t.overview ?? null,
      posterUrl: poster(t),
      tmdbId: t.tmdbId,
      tmdbType: t.tmdbType,
      imdbId: t.imdbId ?? null,
      franchises: franchisesOfTitle(t.id).map((f) => ({ id: f.id, name: localize(f.name, lang), url: pageUrl(origin, lang, `/f/${f.id}`) })),
      url: pageUrl(origin, lang, `/t/${t.id}`),
    },
    { maxAge: CACHE, cors: true },
  );
}

/** GET /api/{resource}[/{id}] del catálogo. `resource` desconocido → 404 en JSON. */
export function catalogApi(request: Request, origin: string): Response {
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  const id = url.searchParams.get("id");
  if (resource === "franchises" && !id) return listFranchises(langOf(url), origin);
  if (resource === "franchises" && id) return getFranchise(id, url, origin);
  if (resource === "titles" && id) return getTitle(id, url, origin);
  return apiNotFound(url.searchParams.get("path") ?? url.pathname);
}

/** Cualquier /api/… que no existe: 404 en JSON, no la página de error de Vercel. */
export function apiNotFound(path: string): Response {
  return apiError(404, `No existe el endpoint ${path.slice(0, 200)}`, "See the endpoint list in /openapi.json or /developers.");
}

const error = { $ref: "#/components/schemas/Error" };
const errorResponses = (...codes: number[]) =>
  Object.fromEntries(codes.map((c) => [String(c), { description: { 400: "Invalid parameters", 404: "Not found", 500: "Internal error", 502: "Upstream (TMDB) error" }[c] ?? "Error", content: { "application/json": { schema: error } } }]));
const langParam = {
  name: "lang",
  in: "query",
  required: false,
  description: "Language of names and descriptions.",
  schema: { type: "string", enum: ["en", "es"], default: "en" },
};
const tmdbParams = [
  { name: "tmdbId", in: "query", required: true, description: "TMDB id of the title (`tmdbId` in GET /api/titles/{id}).", schema: { type: "integer", minimum: 1, example: 299534 } },
  { name: "type", in: "query", required: true, description: "TMDB media type (`tmdbType` in GET /api/titles/{id}).", schema: { type: "string", enum: ["movie", "tv"] } },
];

/** OpenAPI 3.1 de la API pública (las funciones privadas o con sesión no aparecen). */
export function openApiSpec(origin: string): Record<string, unknown> {
  const ok = (description: string, schema: unknown) => ({ description, content: { "application/json": { schema } } });
  return {
    openapi: "3.1.0",
    info: {
      title: "Watch Order API",
      version: API_VERSION,
      summary: "Watch orders for movie and TV franchises: release, chronological, curated orders and routes.",
      description:
        "Public, read-only API of Watch Order (https://watchlist.wxlter.dev). No authentication or API key. Use it to answer \"in what order should I watch X?\": list franchises, get a franchise's titles in a given watch order, look up a title, see upcoming releases, where to stream a title, and its cast. Errors are JSON with `error`, `code`, `status`, `hint` and `docs`. Responses are cached at the CDN; please keep it under ~1 request per second. Title data comes from TMDB (this product uses the TMDB API but is not endorsed or certified by TMDB).",
      contact: { name: "wxlter", email: "work@wxlter.dev", url: `${origin}/contact` },
      termsOfService: `${origin}/terms`,
    },
    externalDocs: { description: "Developer guide", url: `${origin}/developers` },
    servers: [{ url: origin }],
    tags: [
      { name: "catalog", description: "Franchises, watch orders and titles from the curated catalog." },
      { name: "live", description: "Live data from TMDB: upcoming releases, streaming providers and cast." },
      { name: "meta", description: "Service status." },
    ],
    paths: {
      "/api/franchises": {
        get: {
          operationId: "listFranchises",
          tags: ["catalog"],
          summary: "List all franchises",
          description: "Every franchise in the catalog with its id, name, description, number of titles and available watch orders. Use an `id` with getFranchise.",
          parameters: [langParam],
          responses: { "200": ok("All franchises", { $ref: "#/components/schemas/FranchiseList" }) },
        },
      },
      "/api/franchises/{id}": {
        get: {
          operationId: "getFranchise",
          tags: ["catalog"],
          summary: "Get a franchise in a watch order",
          description:
            "A franchise with its continuities, available orders, curated routes and the titles of one order (`order`, default the release order). Each item says how important it is (essential, recommended, optional, skippable).",
          parameters: [
            { name: "id", in: "path", required: true, description: "Franchise id, from listFranchises.", schema: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$", example: "marvel" } },
            { name: "order", in: "query", required: false, description: "Order id from `orders[].id` (e.g. release, chronological). Defaults to the release order.", schema: { type: "string", example: "chronological" } },
            langParam,
          ],
          responses: { "200": ok("The franchise and the titles of the requested order", { $ref: "#/components/schemas/Franchise" }), ...errorResponses(400, 404) },
        },
      },
      "/api/titles/{id}": {
        get: {
          operationId: "getTitle",
          tags: ["catalog"],
          summary: "Get a movie or series",
          description: "A title's metadata (kind, release date, runtime, seasons, overview, poster, TMDB and IMDb ids) and the franchises it belongs to.",
          parameters: [
            { name: "id", in: "path", required: true, description: "Title id, from getFranchise (`order.items[].titleId`).", schema: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$", example: "avengers-endgame-2019" } },
            langParam,
          ],
          responses: { "200": ok("The title", { $ref: "#/components/schemas/Title" }), ...errorResponses(404) },
        },
      },
      "/api/upcoming": {
        get: {
          operationId: "getUpcoming",
          tags: ["live"],
          summary: "Upcoming releases of franchises",
          description: "Releases, new seasons and new episodes in the next 365 days for the given franchises, with dates from TMDB.",
          parameters: [
            { name: "franchise", in: "query", required: true, description: "One or more franchise ids separated by commas (max 200).", schema: { type: "string", example: "marvel,star-wars" } },
          ],
          responses: { "200": ok("Upcoming items sorted by date", { $ref: "#/components/schemas/Upcoming" }), ...errorResponses(400, 404, 502) },
        },
      },
      "/api/providers": {
        get: {
          operationId: "getProviders",
          tags: ["live"],
          summary: "Where to watch a title",
          description: "Streaming, free, ad-supported, rent and buy offers for a title in a country (JustWatch data via TMDB; show JustWatch attribution).",
          parameters: [
            ...tmdbParams,
            { name: "region", in: "query", required: false, description: "ISO 3166-1 country code.", schema: { type: "string", pattern: "^[A-Za-z]{2}$", default: "SV", example: "US" } },
          ],
          responses: { "200": ok("Offers by type", { $ref: "#/components/schemas/Providers" }), ...errorResponses(400, 404, 502) },
        },
      },
      "/api/credits": {
        get: {
          operationId: "getCredits",
          tags: ["live"],
          summary: "Main cast of a title",
          description: "Up to 24 cast members with the character they play (series add up all their roles).",
          parameters: tmdbParams,
          responses: { "200": ok("Cast", { $ref: "#/components/schemas/Credits" }), ...errorResponses(400, 404, 502) },
        },
      },
      "/api/health": {
        get: {
          operationId: "getHealth",
          tags: ["meta"],
          summary: "Service health",
          description: "Returns ok when the functions respond, with the deployed commit.",
          responses: {
            "200": ok("Healthy", { type: "object", required: ["ok", "time"], properties: { ok: { type: "boolean" }, time: { type: "string", format: "date-time" }, commit: { type: "string" } } }),
          },
        },
      },
    },
    components: {
      schemas: {
        Error: {
          type: "object",
          required: ["error", "code", "status", "docs"],
          properties: {
            error: { type: "string", description: "Human-readable message." },
            code: { type: "string", enum: ["invalid_request", "unauthorized", "not_found", "method_not_allowed", "conflict", "payload_too_large", "rate_limited", "internal_error", "upstream_error"] },
            status: { type: "integer", description: "HTTP status code." },
            hint: { type: "string", description: "How to fix the request." },
            docs: { type: "string", description: "Link to the error documentation." },
          },
        },
        OrderSummary: {
          type: "object",
          required: ["id", "type", "name"],
          properties: { id: { type: "string" }, type: { type: "string", enum: ["release", "chronological", "grouped", "curated"] }, name: { type: "string" } },
        },
        FranchiseSummary: {
          type: "object",
          required: ["id", "name", "description", "titleCount", "orders", "routeCount", "url", "apiUrl"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            titleCount: { type: "integer" },
            orders: { type: "array", items: { $ref: "#/components/schemas/OrderSummary" } },
            routeCount: { type: "integer" },
            url: { type: "string", format: "uri", description: "Page in the app." },
            apiUrl: { type: "string", format: "uri" },
          },
        },
        FranchiseList: {
          type: "object",
          required: ["lang", "count", "franchises"],
          properties: { lang: { type: "string" }, count: { type: "integer" }, franchises: { type: "array", items: { $ref: "#/components/schemas/FranchiseSummary" } } },
        },
        OrderItem: {
          type: "object",
          required: ["position", "titleId", "title", "kind", "releaseDate", "importance", "continuityId"],
          properties: {
            position: { type: "integer", minimum: 1 },
            titleId: { type: "string" },
            season: { type: "integer", description: "Present when the item is a single season of a series." },
            title: { type: "string" },
            kind: { type: "string", enum: ["movie", "series", "special", "short", "one-shot", "ova"] },
            releaseDate: { type: "string", format: "date" },
            importance: { type: "string", enum: ["essential", "recommended", "optional", "skippable"] },
            continuityId: { type: "string" },
            section: { type: "string", description: "Group of a grouped order (e.g. a phase)." },
          },
        },
        Franchise: {
          allOf: [
            { $ref: "#/components/schemas/FranchiseSummary" },
            {
              type: "object",
              required: ["lang", "continuities", "order", "routes"],
              properties: {
                lang: { type: "string" },
                continuities: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["id", "name", "canonLevel"],
                    properties: { id: { type: "string" }, name: { type: "string" }, canonLevel: { type: "string", enum: ["main", "semicanon", "alternate", "non-canon"] }, hiddenByDefault: { type: "boolean" } },
                  },
                },
                order: {
                  type: "object",
                  required: ["id", "type", "name", "items"],
                  properties: { id: { type: "string" }, type: { type: "string" }, name: { type: "string" }, items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } } },
                },
                routes: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["id", "kind", "name", "description", "titleIds", "url"],
                    properties: {
                      id: { type: "string" },
                      kind: { type: "string", enum: ["character", "theme", "prep"] },
                      name: { type: "string" },
                      description: { type: "string" },
                      titleIds: { type: "array", items: { type: "string" }, description: "Title ids; \"id#2\" is season 2 only." },
                      targetTitleId: { type: "string", description: "For prep routes: the release they prepare for." },
                      url: { type: "string", format: "uri" },
                    },
                  },
                },
              },
            },
          ],
        },
        Title: {
          type: "object",
          required: ["lang", "id", "title", "originalTitle", "kind", "releaseDate", "overview", "posterUrl", "tmdbId", "tmdbType", "imdbId", "franchises", "url"],
          properties: {
            lang: { type: "string" },
            id: { type: "string" },
            title: { type: "string" },
            originalTitle: { type: "string" },
            kind: { type: "string", enum: ["movie", "series", "special", "short", "one-shot", "ova"] },
            releaseDate: { type: "string", format: "date" },
            runtimeMin: { type: "integer" },
            seasons: { type: "array", items: { type: "object", required: ["number", "episodes"], properties: { number: { type: "integer" }, episodes: { type: "integer" }, airDate: { type: "string", format: "date" } } } },
            ongoing: { type: "boolean" },
            overview: { type: ["string", "null"] },
            posterUrl: { type: ["string", "null"], format: "uri" },
            tmdbId: { type: "integer" },
            tmdbType: { type: "string", enum: ["movie", "tv"] },
            imdbId: { type: ["string", "null"] },
            franchises: { type: "array", items: { type: "object", required: ["id", "name", "url"], properties: { id: { type: "string" }, name: { type: "string" }, url: { type: "string", format: "uri" } } } },
            url: { type: "string", format: "uri" },
          },
        },
        Upcoming: {
          type: "object",
          required: ["generatedAt", "items"],
          properties: {
            generatedAt: { type: "string", format: "date-time" },
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["titleId", "franchiseId", "date", "kind"],
                properties: {
                  titleId: { type: "string" },
                  franchiseId: { type: "string" },
                  date: { type: "string", format: "date" },
                  kind: { type: "string", enum: ["release", "season", "episode"] },
                  season: { type: "integer" },
                  episode: { type: "integer" },
                },
              },
            },
          },
        },
        Provider: { type: "object", required: ["id", "name", "logoPath"], properties: { id: { type: "integer" }, name: { type: "string" }, logoPath: { type: "string", description: "TMDB image path (prefix https://image.tmdb.org/t/p/w92)." } } },
        Providers: {
          type: "object",
          required: ["region", "link", "flatrate", "free", "ads", "rent", "buy"],
          properties: {
            region: { type: "string" },
            link: { type: ["string", "null"], format: "uri", description: "TMDB/JustWatch page for the title in that region." },
            ...Object.fromEntries(["flatrate", "free", "ads", "rent", "buy"].map((k) => [k, { type: "array", items: { $ref: "#/components/schemas/Provider" } }])),
          },
        },
        Credits: {
          type: "object",
          required: ["cast"],
          properties: {
            cast: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "name", "character", "profilePath"],
                properties: { id: { type: "integer" }, name: { type: "string" }, character: { type: "string" }, profilePath: { type: ["string", "null"] }, episodes: { type: "integer" } },
              },
            },
          },
        },
      },
    },
  };
}

export function openApiResponse(origin: string): Response {
  return json(openApiSpec(origin), { maxAge: 86_400, cors: true });
}
