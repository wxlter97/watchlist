// GET /sitemap.xml → portada, franquicias, títulos y páginas legales, desde el catálogo.
import { titlesById } from "./_lib/catalog.js";
import { esc, franchiseIds, siteOrigin } from "./_lib/seo.js";

export function GET(request: Request): Response {
  const origin = siteOrigin(request);
  const urls = ["/", ...franchiseIds().map((id) => `/f/${id}`), ...[...titlesById().keys()].sort().map((id) => `/t/${id}`), "/privacy", "/terms"];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(origin + u)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
