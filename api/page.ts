// Una sola función para las páginas públicas (el plan Hobby de Vercel limita las funciones). Los
// rewrites de vercel.json mandan aquí:
//   /f/{id}, /f/{id}/r/{ruta}, /t/{id}, /faq, /guide, /about, /contact, /developers, /privacy,
//     /terms y sus versiones /en/… → el HTML de la app con título, descripción, canonical,
//     hreflang, Open Graph, JSON-LD y el contenido en texto, para buscadores y modelos de IA (que
//     no ejecutan JavaScript). React lo reemplaza al montar. Con `Accept: text/markdown`, el
//     mismo contenido en Markdown (la portada española llega por middleware.ts).
//   Cualquier ruta que la app no tiene (type=404) → 404 con noindex (la app muestra "no encontrado").
//   /sitemap.xml, /robots.txt, /llms.txt → generados desde el catálogo; /ads.txt, del ID de AdSense.
//   /openapi.json y la API del catálogo (/api/franchises, /api/titles/…) → api/_lib/catalogApi.ts;
//     cualquier otro /api/… que no existe → 404 en JSON.
import { apiNotFound, catalogApi, openApiResponse } from "./_lib/catalogApi.js";
import { titlesById } from "./_lib/catalog.js";
import { htmlToMarkdown, markdownResponse, negotiate, notAcceptable, VARY } from "./_lib/negotiate.js";
import {
  CONTENT_KINDS,
  contentPage,
  franchiseIds,
  franchisePage,
  homePage,
  inject,
  legalPage,
  notFoundPage,
  routePage,
  siteOrigin,
  titlePage,
  type ContentKind,
  type PageSeo,
} from "./_lib/seo.js";
import { withPolicy } from "./_lib/policy.js";
import { adsTxt, llms, robots, sitemap } from "./_lib/seoFiles.js";

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FOUND_CACHE = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
const NOT_FOUND_CACHE = "public, max-age=0, s-maxage=300";

/** La ruta pedida por el visitante: en un 404 llega como ?path= (vercel.json), sin la barra inicial. */
function requestedPath(url: URL): string {
  const raw = url.searchParams.get("path");
  if (raw === null) return url.pathname;
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    // Se deja tal cual: solo se muestra en el mensaje.
  }
  return `/${path.replace(/^\/+/, "")}`;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type === "sitemap") return sitemap(request);
  if (type === "robots") return robots(request);
  if (type === "ads") return adsTxt();
  if (type === "llms") return llms(request);

  const origin = siteOrigin(request);
  if (type === "openapi") return withPolicy(request, () => openApiResponse(origin));
  if (type === "api") return withPolicy(request, () => catalogApi(request, origin));
  if (type === "api-404") return withPolicy(request, () => apiNotFound(`/api${requestedPath(url)}`));

  const id = url.searchParams.get("id") ?? "";
  const path = requestedPath(url);
  const lang = url.searchParams.get("lang") === "en" || (type === "404" && /^\/en(\/|$)/.test(path)) ? "en" : "es";

  let seo: PageSeo | undefined;
  const routeId = url.searchParams.get("route") ?? "";
  if (type === "home") seo = homePage(lang, origin);
  else if (CONTENT_KINDS.includes(type as ContentKind)) seo = contentPage(type as ContentKind, lang, origin);
  else if (type === "privacy" || type === "terms") seo = legalPage(type, lang, origin);
  else if (ID.test(id)) {
    if (type === "f" && franchiseIds().includes(id)) seo = franchisePage(id, lang, origin);
    else if (type === "t" && titlesById().has(id)) seo = titlePage(id, lang, origin);
    else if (type === "r" && franchiseIds().includes(id) && ID.test(routeId)) seo = routePage(id, routeId, lang, origin);
  }
  // Un id que no existe en /f, /t o /f/…/r: la ruta pública, no la de la función.
  const publicPath = type === "f" || type === "t" ? `/${type}/${id}` : type === "r" ? `/f/${id}/r/${routeId}` : path;
  const page = seo ?? notFoundPage(type === "404" ? path : `${lang === "en" ? "/en" : ""}${publicPath}`, lang, origin);
  const status = seo ? 200 : 404;
  const cacheControl = seo ? FOUND_CACHE : NOT_FOUND_CACHE;

  // HTML para navegadores, Markdown para agentes (Accept: text/markdown); 406 si no acepta ninguno.
  const format = negotiate(request.headers.get("accept"));
  if (format === null && seo) return notAcceptable();
  if (format === "markdown") {
    const res = markdownResponse(htmlToMarkdown(page.body, origin), { status, cacheControl });
    if (page.noindex) res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }

  // El HTML de la app es el estático del build (los archivos tienen prioridad sobre los rewrites).
  const shell = await fetch(`${url.origin}/index.html`).catch(() => undefined);
  if (!shell?.ok) return new Response("Service unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  const html = await shell.text();

  return new Response(inject(html, page, lang, origin), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", Vary: VARY, "Cache-Control": cacheControl },
  });
}
