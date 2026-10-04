// Una sola función para el SEO (el plan Hobby de Vercel limita las funciones). Los rewrites de
// vercel.json mandan aquí:
//   /f/{id}, /f/{id}/r/{ruta}, /t/{id}, /faq, /guide y sus versiones /en/… → el HTML de la app con título, descripción,
//     canonical, hreflang, Open Graph, JSON-LD y el contenido en texto, para buscadores y modelos
//     de IA (que no ejecutan JavaScript). React lo reemplaza al montar. Un id que no existe
//     responde 404 con noindex (la app muestra "no encontrado").
//   /sitemap.xml, /robots.txt, /llms.txt → generados desde el catálogo; /ads.txt, del ID de AdSense.
import { titlesById } from "./_lib/catalog.js";
import { contentPage, franchiseIds, franchisePage, homePage, inject, prefixOf, routePage, siteOrigin, TEXT, titlePage, type PageSeo } from "./_lib/seo.js";
import { adsTxt, llms, robots, sitemap } from "./_lib/seoFiles.js";

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type === "sitemap") return sitemap(request);
  if (type === "robots") return robots(request);
  if (type === "ads") return adsTxt();
  if (type === "llms") return llms(request);

  const id = url.searchParams.get("id") ?? "";
  const origin = siteOrigin(request);
  const lang = url.searchParams.get("lang") === "en" ? "en" : "es";

  let seo: PageSeo | undefined;
  const routeId = url.searchParams.get("route") ?? "";
  if (type === "home" && lang === "en") seo = homePage(lang, origin);
  else if (type === "faq" || type === "guide") seo = contentPage(type, lang, origin);
  else if (ID.test(id)) {
    if (type === "f" && franchiseIds().includes(id)) seo = franchisePage(id, lang, origin);
    else if (type === "t" && titlesById().has(id)) seo = titlePage(id, lang, origin);
    else if (type === "r" && franchiseIds().includes(id) && ID.test(routeId)) seo = routePage(id, routeId, lang, origin);
  }

  // El HTML de la app es el estático del build (los archivos tienen prioridad sobre los rewrites).
  const shell = await fetch(`${url.origin}/index.html`).catch(() => undefined);
  if (!shell?.ok) return new Response("Service unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  const html = await shell.text();

  const notFound: PageSeo = {
    title: TEXT[lang].notFound,
    description: TEXT[lang].siteDescription,
    path: `${prefixOf(lang)}${url.pathname}`,
    image: `${origin}/api/og?kind=page&lang=${lang}`,
    body: "",
    jsonLd: [],
    noindex: true,
  };
  return new Response(inject(html, seo ?? notFound, lang, origin), {
    status: seo ? 200 : 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": seo ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" : "public, max-age=0, s-maxage=300",
    },
  });
}
