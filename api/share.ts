// GET /{lang}/s/{shareId} (reescrito a /api/share?lang=&id=) → página pública de solo lectura
// de un link compartido, renderizada en el servidor con metadatos Open Graph (SPEC §7, §9.5).
// Funciona sin JavaScript y sin sesión; muestra la foto guardada, nunca el progreso vivo.
import type { Lang } from "../src/lib/types";
import { localize, readFranchise, titleName, titlesById } from "./_lib/catalog";
import { loadShare, type PublicShare } from "./_lib/shares";
import { HttpError } from "./_lib/tmdb";

const TEXT = {
  es: {
    kinds: { route: "Ruta", "custom-order": "Orden personalizado", progress: "Progreso" },
    by: "Compartido por",
    watched: (w: number, t: number) => `${w} de ${t} vistos`,
    seen: "Visto",
    cta: "Abrir en Watch Order",
    ctaHint: "Sigue tus sagas en el orden que prefieras. Gratis, sin anuncios.",
    gone: "Este link ya no está disponible",
    goneBody: "Quien lo compartió lo revocó, o nunca existió.",
    home: "Ir a Watch Order",
    tmdb: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
  },
  en: {
    kinds: { route: "Route", "custom-order": "Custom order", progress: "Progress" },
    by: "Shared by",
    watched: (w: number, t: number) => `${w} of ${t} watched`,
    seen: "Watched",
    cta: "Open in Watch Order",
    ctaHint: "Follow your sagas in the order you prefer. Free, no ads.",
    gone: "This link is no longer available",
    goneBody: "Whoever shared it revoked it, or it never existed.",
    home: "Go to Watch Order",
    tmdb: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
  },
} as const;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function onColor(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const lum = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * lum[0]! + 0.7152 * lum[1]! + 0.0722 * lum[2]!;
  // Contraste contra Tinta (#111, luminancia ~0.0056) vs. blanco.
  return (l + 0.05) / 0.0556 >= 1.05 / (l + 0.05) ? "#111111" : "#FFFFFF";
}

const STYLE = `
*{box-sizing:border-box;margin:0}
:root{--faro:#FFDB00;--bg:#F4F3EF;--fg:#111;--line:#111;--soft:#C9C9C2;--muted:#6B6B63;--surface:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#EDEDE7;--line:#EDEDE7;--soft:#3D3D38;--muted:#8A8A80;--surface:#1C1C1A}}
body{background:var(--bg);color:var(--fg);font:16px/1.5 Archivo,"Helvetica Neue",Arial,sans-serif}
.wrap{max-width:720px;margin:0 auto;padding:0 16px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;height:58px;border-bottom:2px solid var(--line)}
.brand{display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;font-family:"Archivo Black",Archivo,sans-serif;font-size:18px}
.mark{display:grid;place-items:center;width:30px;height:30px;background:var(--faro);color:#111;font-size:17px}
.lang{font:700 11px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:inherit}
.band{margin:0 -16px;padding:28px 16px 32px;border-bottom:2px solid var(--line)}
.label{font:700 11px "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase}
h1{font-family:"Archivo Black",Archivo,sans-serif;font-size:39px;line-height:1.02;letter-spacing:-.02em;margin-top:14px;text-wrap:balance}
.by{margin-top:10px;font-size:15px}
.bar{margin-top:20px;height:14px;border:2px solid currentColor}
.bar>div{height:100%;background:currentColor}
.count{margin-top:8px;font:12px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase}
ol{list-style:none;padding:0;margin:24px 0 0}
li{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:2px solid var(--soft)}
.n{width:24px;text-align:right;font:12px "JetBrains Mono",monospace;color:var(--muted)}
.p{width:40px;height:60px;flex:none;border:2px solid var(--line);background:var(--soft);object-fit:cover}
.t{flex:1;min-width:0}
.t b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.t span{font:11px "JetBrains Mono",monospace;color:var(--muted);text-transform:uppercase}
.seen .t b{color:var(--muted)}
.ok{flex:none;display:grid;place-items:center;width:32px;height:32px;border:2px solid var(--line);font-weight:700}
.seen .ok{background:var(--accent);color:var(--on-accent)}
.cta{margin:32px 0;padding:20px;border:2px solid var(--line);background:var(--surface)}
.btn{display:inline-block;margin-top:14px;padding:11px 20px;border:2px solid #111;background:var(--faro);color:#111;font-weight:700;text-decoration:none}
.btn:hover{background:#111;color:var(--faro)}
footer{padding:24px 0 40px;font:11px "JetBrains Mono",monospace;color:var(--muted)}
a:focus-visible,.btn:focus-visible{outline:3px solid var(--faro);outline-offset:2px}
`;

function page(lang: Lang, head: string, body: string, alternate: string): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#111111">
<link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
${head}
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header class="top"><a class="brand" href="/"><span class="mark">O</span>Watch Order</a><a class="lang" href="${alternate}">${lang === "es" ? "English" : "Español"}</a></header>
${body}
<footer>${TEXT[lang].tmdb}</footer>
</div>
</body>
</html>`;
}

function render(share: PublicShare, lang: Lang, origin: string): string {
  const t = TEXT[lang];
  const franchise = readFranchise(share.franchiseId);
  const accent = franchise.accentColor;
  const fg = onColor(accent);
  const titles = titlesById();
  const watched = new Set(share.snapshot.watched);
  const total = share.snapshot.titleIds.length;
  const count = share.snapshot.titleIds.filter((id) => watched.has(id)).length;
  const kind = t.kinds[share.kind];
  const franchiseName = localize(franchise.name, lang);
  // Una ruta se nombra en el idioma de la página; los demás conservan el título con que se compartieron.
  const route = share.kind === "route" ? franchise.routes?.find((r) => r.id === share.refId) : undefined;
  const heading = route ? localize(route.name, lang) : share.title;
  const url = `${origin}/${lang}/s/${share.id}`;
  const image = `${origin}/api/og?kind=share&id=${share.id}&lang=${lang}&v=${share.updatedAtMs}`;
  const description = `${franchiseName} · ${kind} · ${t.watched(count, total)}`;
  const appLink = share.kind === "route" ? `/f/${share.franchiseId}/r/${share.refId}` : `/f/${share.franchiseId}`;

  const rows = share.snapshot.titleIds
    .map((id, i) => {
      const title = titles.get(id);
      if (!title) return "";
      const seen = watched.has(id);
      const poster = title.posterPath ? `<img class="p" src="https://image.tmdb.org/t/p/w92${esc(title.posterPath)}" alt="" loading="lazy">` : `<span class="p"></span>`;
      return `<li class="${seen ? "seen" : ""}"><span class="n">${String(i + 1).padStart(2, "0")}</span>${poster}<span class="t"><b>${esc(titleName(title, lang))}</b><span>${title.releaseDate.slice(0, 4)}</span></span><span class="ok" ${seen ? `aria-label="${t.seen}"` : 'aria-hidden="true"'}>${seen ? "✓" : ""}</span></li>`;
    })
    .join("");

  const head = `<title>${esc(heading)} · Watch Order</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Watch Order">
<meta property="og:title" content="${esc(heading)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${lang === "es" ? "es_MX" : "en_US"}">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" hreflang="${lang === "es" ? "en" : "es"}" href="${esc(`${origin}/${lang === "es" ? "en" : "es"}/s/${share.id}`)}">`;

  const body = `<section class="band" style="background:${accent};color:${fg};--accent:${accent};--on-accent:${fg}">
<p class="label">${esc(franchiseName)} · ${esc(kind)}</p>
<h1>${esc(heading)}</h1>
<p class="by">${t.by} <b>${esc(share.ownerName)}</b></p>
<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${count}"><div style="width:${total ? Math.round((count / total) * 100) : 0}%"></div></div>
<p class="count">${t.watched(count, total)}</p>
</section>
<ol style="--accent:${accent};--on-accent:${fg}">${rows}</ol>
<section class="cta"><p>${t.ctaHint}</p><a class="btn" href="${esc(appLink)}">${t.cta}</a></section>`;

  return page(lang, head, body, `/${lang === "es" ? "en" : "es"}/s/${share.id}`);
}

function gone(lang: Lang): string {
  const t = TEXT[lang];
  return page(
    lang,
    `<title>${t.gone} · Watch Order</title>`,
    `<section class="cta"><h1>${t.gone}</h1><p class="by">${t.goneBody}</p><a class="btn" href="/">${t.home}</a></section>`,
    lang === "es" ? "/en" : "/es",
  );
}

const html = (body: string, status: number, cache: string) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cache } });

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const lang: Lang = url.searchParams.get("lang") === "en" ? "en" : "es";
  try {
    const share = await loadShare(url.searchParams.get("id") ?? url.searchParams.get("file") ?? "");
    // Corto en el CDN: revocar o re-compartir se nota en un minuto.
    return html(render(share, lang, url.origin), 200, "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return html(gone(lang), 404, "public, max-age=0, s-maxage=60");
    console.error(err);
    return html(gone(lang), err instanceof HttpError ? err.status : 500, "no-store");
  }
}
