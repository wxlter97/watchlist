// GET /f/{franquicia} y /t/{título} (reescritos a /api/page?type=&id=) → el mismo HTML de la app
// con título, descripción, canonical, Open Graph, JSON-LD y el contenido en texto, para que
// buscadores y modelos de IA (que no ejecutan JavaScript) lo vean. React reemplaza el contenido
// al montar. Un id que no existe responde 404 con noindex (la app muestra "no encontrado").
import { titlesById } from "./_lib/catalog.js";
import { franchiseIds, franchisePage, inject, siteOrigin, TEXT, titlePage, type PageSeo } from "./_lib/seo.js";

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id") ?? "";
  const origin = siteOrigin(request);
  // El shell y la mayor parte del texto están en español; el idioma real lo elige la app al montar.
  const lang = "es" as const;

  let seo: PageSeo | undefined;
  if (ID.test(id)) {
    if (type === "f" && franchiseIds().includes(id)) seo = franchisePage(id, lang, origin);
    else if (type === "t" && titlesById().has(id)) seo = titlePage(id, lang, origin);
  }

  // El HTML de la app es el estático del build (los archivos tienen prioridad sobre los rewrites).
  const shell = await fetch(`${url.origin}/index.html`).catch(() => undefined);
  if (!shell?.ok) return new Response("Service unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  const html = await shell.text();

  const notFound: PageSeo = { title: TEXT[lang].notFound, description: TEXT[lang].siteDescription, path: url.pathname, image: `${origin}/api/og?kind=page&lang=${lang}`, body: "", jsonLd: [], noindex: true };
  return new Response(inject(html, seo ?? notFound, lang, origin), {
    status: seo ? 200 : 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": seo ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" : "public, max-age=0, s-maxage=300",
    },
  });
}
