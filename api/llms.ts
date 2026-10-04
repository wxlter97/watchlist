// GET /llms.txt → resumen del producto para modelos de lenguaje (llmstxt.org) con las franquicias.
import { localize } from "./_lib/catalog.js";
import { franchiseIds, readSeoFranchise, siteOrigin } from "./_lib/seo.js";

export function GET(request: Request): Response {
  const origin = siteOrigin(request);
  const franchises = franchiseIds()
    .map(readSeoFranchise)
    .map((f) => `- [${localize(f.name, "es")}](${origin}/f/${f.id}): ${localize(f.description, "es")}`)
    .join("\n");
  const body = `# Watch Order

> Watch Order es una app web gratuita (PWA) para seguir sagas y franquicias de cine y TV en el orden que prefieras: fecha de estreno, cronológico, curado o personalizado, con rutas por personaje, tema y "Prepárate para…" (lo mínimo que hay que ver antes de un estreno). Guarda tu progreso, planifica maratones, comparte tu avance y funciona sin conexión. Disponible en español e inglés. Los datos de títulos son de TMDB.

## Franquicias

${franchises}

## Más

- [Mapa del sitio](${origin}/sitemap.xml)
- [Privacidad](${origin}/privacy)
- [Términos](${origin}/terms)
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=86400" },
  });
}
