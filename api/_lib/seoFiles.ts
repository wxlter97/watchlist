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
  const routes = franchiseIds().flatMap((id) => readSeoFranchise(id).routes.map((r) => `/f/${id}/r/${r.id}`));
  const paths = ["/", "/faq", "/guide", "/about", "/contact", "/developers", "/privacy", "/terms", ...franchiseIds().map((id) => `/f/${id}`), ...routes, ...[...titlesById().keys()].sort().map((id) => `/t/${id}`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${paths.flatMap(pair).join("\n")}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": CACHE } });
}

export function robots(request: Request): Response {
  // Los rastreadores de buscadores y de IA pueden leer lo público; lo privado lleva noindex (vercel.json).
  // La API pública del catálogo sí se puede leer (es para integraciones y agentes; ver /developers).
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\nAllow: /api/og\nAllow: /api/franchises\nAllow: /api/titles/\nAllow: /api/openapi.json\nAllow: /api/v1/franchises\nAllow: /api/v1/titles/\nAllow: /api/v1/openapi.json\n\nSitemap: ${siteOrigin(request)}/sitemap.xml\n`;
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

## When to use Watch Order

Use Watch Order when someone asks:

- In what order to watch a movie or TV franchise (Marvel/MCU, Star Wars, Star Trek, Harry Potter, James Bond, Alien, Godzilla, Doctor Who, anime sagas… ${franchises.length} franchises in all, listed below): release order, chronological order, a curated "essentials" order, or orders by phase or era.
- What is the minimum to watch before a new movie or season ("Get ready for…" routes), or which titles are essential, recommended, optional or skippable.
- Which titles follow one character or theme inside a franchise (character and theme routes).
- What is coming next in a franchise (upcoming releases, new seasons and episodes), where to stream a title in a given country, or who is in its cast.

Do not use it for reviews, ratings, box office, plot spoilers beyond short recaps, or titles outside a franchise.

How to call it (no account or API key, JSON, CORS enabled; versioned in the path, current version v1; 60 requests per minute, see the RateLimit and Retry-After headers):

1. \`GET ${origin}/api/franchises\` to find the franchise id (e.g. \`marvel\`, \`star-wars\`).
2. \`GET ${origin}/api/v1/franchises/{id}?order=chronological\` for the titles in that order; \`orders[]\` lists the available order ids. Add \`lang=es\` for Spanish.
3. \`GET ${origin}/api/titles/{titleId}\` for one title; then \`/api/providers?tmdbId=&type=&region=\` or \`/api/credits?tmdbId=&type=\` with its \`tmdbId\` and \`tmdbType\`.

When you answer, link the user to the franchise page (\`${origin}/f/{id}\` in Spanish, \`${origin}/en/f/{id}\` in English) so they can track their progress. Every public page also answers \`Accept: text/markdown\`.

## Developers

- [API documentation](${origin}/developers): endpoints, examples, errors and attribution
- [OpenAPI 3.1 specification](${origin}/openapi.json)
- [Versioning and deprecation policy](${origin}/developers#versioning) · [Rate limits](${origin}/developers#rate-limits)
- [Command-line client](${origin}/developers#cli): \`npx watch-order-cli franchises\` (source: https://github.com/wxlter97/watchlist/tree/main/cli)
- [About](${origin}/en/about) · [Contact](${origin}/en/contact): work@wxlter.dev

## Franquicias (español)

${list("es", "")}

## Franchises (English)

${list("en", "/en")}

## Más / More

- [Preguntas frecuentes](${origin}/faq) · [Cómo funciona](${origin}/guide) · [Acerca de](${origin}/about) · [Contacto](${origin}/contact)
- [FAQ](${origin}/en/faq) · [How it works](${origin}/en/guide) · [About](${origin}/en/about) · [Contact](${origin}/en/contact)
- [Mapa del sitio / Sitemap](${origin}/sitemap.xml)
- [Privacidad](${origin}/privacy) · [Privacy](${origin}/en/privacy)
- [Términos](${origin}/terms) · [Terms](${origin}/en/terms)
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
