// GET /robots.txt → mismas reglas de siempre más el sitemap con el dominio real. Los rastreadores
// de buscadores y de IA pueden leer lo público; las rutas con sesión llevan noindex (vercel.json).
import { siteOrigin } from "./_lib/seo.js";

export function GET(request: Request): Response {
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\nAllow: /api/og\n\nSitemap: ${siteOrigin(request)}/sitemap.xml\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=86400" },
  });
}
