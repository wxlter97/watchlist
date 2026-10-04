// /sitemap.xml, /robots.txt y /llms.txt: salen de api/page.ts (una sola función para el SEO).
import { localize, titlesById } from "./catalog.js";
import { esc, franchiseIds, readSeoFranchise, siteOrigin } from "./seo.js";

const CACHE = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export function sitemap(request: Request): Response {
  const origin = siteOrigin(request);
  // Cada página con su versión en español (sin prefijo) e inglés (/en), enlazadas con hreflang.
  const pair = (path: string) => {
    const es = path;
    const en = path === "/" ? "/en" : `/en${path}`;
    const link = (lang: string, href: string) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${esc(origin + href)}"/>`;
    return [es, en].map((loc) => `  <url><loc>${esc(origin + loc)}</loc>${link("es", es)}${link("en", en)}${link("x-default", es)}</url>`);
  };
  const paths = ["/", ...franchiseIds().map((id) => `/f/${id}`), ...[...titlesById().keys()].sort().map((id) => `/t/${id}`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${paths.flatMap(pair).join("\n")}
  <url><loc>${esc(origin)}/privacy</loc></url>
  <url><loc>${esc(origin)}/terms</loc></url>
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": CACHE } });
}

export function robots(request: Request): Response {
  // Los rastreadores de buscadores y de IA pueden leer lo público; lo privado lleva noindex (vercel.json).
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\nAllow: /api/og\n\nSitemap: ${siteOrigin(request)}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=86400" } });
}

export function llms(request: Request): Response {
  const origin = siteOrigin(request);
  const franchises = franchiseIds().map(readSeoFranchise);
  const list = (lang: "es" | "en", prefix: string) =>
    franchises.map((f) => `- [${localize(f.name, lang)}](${origin}${prefix}/f/${f.id}): ${localize(f.description, lang)}`).join("\n");
  const body = `# Watch Order

> Watch Order es una app web gratuita (PWA) para seguir sagas y franquicias de cine y TV en el orden que prefieras: fecha de estreno, cronológico, curado o personalizado, con rutas por personaje, tema y "Prepárate para…" (lo mínimo que hay que ver antes de un estreno). Guarda tu progreso, planifica maratones, comparte tu avance y funciona sin conexión. Disponible en español e inglés. Los datos de títulos son de TMDB.

> Watch Order is a free web app (PWA) to follow movie and TV franchises in the order you like: release, chronological, curated or custom, with routes by character and theme, and "Get ready for…" (the minimum to watch before a release). It keeps your progress, plans marathons, shares your progress and works offline. Available in Spanish and English. Title data comes from TMDB.

## Franquicias (español)

${list("es", "")}

## Franchises (English)

${list("en", "/en")}

## Más / More

- [Mapa del sitio / Sitemap](${origin}/sitemap.xml)
- [Privacidad / Privacy](${origin}/privacy)
- [Términos / Terms](${origin}/terms)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=86400" } });
}

/**
 * /ads.txt: autoriza a Google a vender los anuncios de este dominio. Sale de VITE_ADS_CLIENT
 * ("ca-pub-123…" → "pub-123…"); sin él, no hay anuncios y el archivo solo lo dice.
 */
export function adsTxt(): Response {
  const client = (process.env.VITE_ADS_CLIENT ?? "").trim();
  const pub = /^ca-(pub-\d{10,20})$/.exec(client)?.[1];
  const body = pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : "# Sin anuncios configurados (VITE_ADS_CLIENT).\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
