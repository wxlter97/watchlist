// Metadatos y contenido público para buscadores y modelos de IA: la app es una SPA, así que las
// páginas de franquicia y título salen de /api/page con el HTML real (ver api/page.ts).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Lang, LocalizedText } from "../../src/lib/types.js";
import { localize, readData, titleName, titlesById, type ServerTitle } from "./catalog.js";

export interface SeoFranchise {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  accentColor: string;
  entries: { titleId: string }[];
}

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Dominio público para canonical y Open Graph: el configurado, o el del request. */
export function siteOrigin(request: Request): string {
  const configured = process.env.SITE_URL ?? process.env.VITE_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

let ids: string[] | undefined;
export function franchiseIds(): string[] {
  ids ??= readdirSync(join(process.cwd(), "src", "data", "franchises"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort();
  return ids;
}

export const readSeoFranchise = (id: string) => readData<SeoFranchise>(join("franchises", `${id}.json`));

/** Franquicias en las que aparece un título (como entry). */
export function franchisesOfTitle(titleId: string): SeoFranchise[] {
  return franchiseIds()
    .map(readSeoFranchise)
    .filter((f) => f.entries.some((e) => e.titleId === titleId));
}

export const year = (t: ServerTitle) => t.releaseDate.slice(0, 4);

const KIND: Record<Lang, Record<string, string>> = {
  es: { movie: "película", series: "serie", special: "especial", short: "corto", "one-shot": "one-shot", ova: "OVA" },
  en: { movie: "movie", series: "series", special: "special", short: "short", "one-shot": "one-shot", ova: "OVA" },
};
export const kindName = (kind: string, lang: Lang) => KIND[lang][kind] ?? kind;

export const TEXT = {
  es: {
    siteTitle: "Watch Order — Tus sagas, en el orden que prefieras",
    siteDescription: "Sigue sagas y franquicias de cine y TV en el orden que prefieras: estreno, cronológico y rutas. Gratis, sin anuncios.",
    franchiseTitle: (name: string) => `${name}: en qué orden verla | Watch Order`,
    franchiseDescription: (name: string, n: number) => `Orden para ver ${name}: ${n} títulos por fecha de estreno, cronológico y rutas, con tu progreso.`,
    titleTitle: (name: string, y: string) => `${name} (${y}) | Watch Order`,
    titleDescription: (name: string, kind: string, y: string, franchises: string) =>
      `${name} (${y}), ${kind}${franchises ? ` de ${franchises}` : ""}. Dónde encaja en el orden de visualización, reparto y dónde verla.`,
    notFound: "No encontramos esta página | Watch Order",
    inOrder: "Títulos por fecha de estreno",
    open: "Abrir en Watch Order",
    appearsIn: "Aparece en",
    locale: "es_MX",
  },
  en: {
    siteTitle: "Watch Order — Your sagas, in the order you like",
    siteDescription: "Follow movie and TV franchises in the order you like: release, chronological and routes. Free, no ads.",
    franchiseTitle: (name: string) => `${name}: what order to watch | Watch Order`,
    franchiseDescription: (name: string, n: number) => `What order to watch ${name}: ${n} titles by release date, chronological and routes, with your progress.`,
    titleTitle: (name: string, y: string) => `${name} (${y}) | Watch Order`,
    titleDescription: (name: string, kind: string, y: string, franchises: string) =>
      `${name} (${y}), ${kind}${franchises ? ` from ${franchises}` : ""}. Where it fits in the watch order, cast and where to watch.`,
    notFound: "We couldn't find this page | Watch Order",
    inOrder: "Titles by release date",
    open: "Open in Watch Order",
    appearsIn: "Appears in",
    locale: "en_US",
  },
} as const;

/** Las páginas en inglés viven bajo /en; el español, sin prefijo (es también el x-default). */
export const prefixOf = (lang: Lang) => (lang === "en" ? "/en" : "");

export interface PageSeo {
  title: string;
  description: string;
  /** Ruta canónica de esta versión, p. ej. "/f/saw" o "/en/f/saw". */
  path: string;
  /** Mismas páginas en cada idioma (para hreflang); sin ellas, la página no tiene versión paralela. */
  alternates?: Record<Lang, string>;
  image: string;
  /** Contenido visible para quien no ejecuta JavaScript. */
  body: string;
  jsonLd: unknown[];
  noindex?: boolean;
}

const schemaType = (t: ServerTitle) => (t.tmdbType === "movie" ? "Movie" : "TVSeries");
const posterUrl = (t: ServerTitle) => (t.posterPath ? `https://image.tmdb.org/t/p/w500${t.posterPath}` : undefined);

export function franchisePage(id: string, lang: Lang, origin: string): PageSeo {
  const f = readSeoFranchise(id);
  const titles = titlesById();
  const name = localize(f.name, lang);
  const ordered = [...new Set(f.entries.map((e) => e.titleId))]
    .flatMap((tid) => (titles.has(tid) ? [titles.get(tid)!] : []))
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.id.localeCompare(b.id));
  const t = TEXT[lang];
  const p = prefixOf(lang);
  const list = ordered.map((x) => `<li><a href="${p}/t/${esc(x.id)}">${esc(titleName(x, lang))}</a> (${year(x)})</li>`).join("");
  return {
    title: t.franchiseTitle(name),
    description: t.franchiseDescription(name, ordered.length),
    path: `${p}/f/${id}`,
    alternates: { es: `/f/${id}`, en: `/en/f/${id}` },
    image: `${origin}/api/og?kind=page&lang=${lang}&f=${id}`,
    body: `<section><h1>${esc(name)}</h1><p>${esc(localize(f.description, lang))}</p><h2>${t.inOrder}</h2><ol>${list}</ol></section>`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name,
        description: localize(f.description, lang),
        url: `${origin}${p}/f/${id}`,
        inLanguage: lang,
        numberOfItems: ordered.length,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        itemListElement: ordered.map((x, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${origin}${p}/t/${x.id}`,
          name: titleName(x, lang),
        })),
      },
      breadcrumbs(origin, [[lang === "es" ? "Inicio" : "Home", p || "/"], [name, `${p}/f/${id}`]]),
    ],
  };
}

export function titlePage(id: string, lang: Lang, origin: string): PageSeo {
  const x = titlesById().get(id)!;
  const t = TEXT[lang];
  const name = titleName(x, lang);
  const franchises = franchisesOfTitle(id);
  const names = franchises.map((f) => localize(f.name, lang));
  const p = prefixOf(lang);
  const links = franchises.map((f) => `<li><a href="${p}/f/${esc(f.id)}">${esc(localize(f.name, lang))}</a></li>`).join("");
  const description = t.titleDescription(name, kindName(x.kind, lang), year(x), names.slice(0, 2).join(", "));
  return {
    title: t.titleTitle(name, year(x)),
    description,
    path: `${p}/t/${id}`,
    alternates: { es: `/t/${id}`, en: `/en/t/${id}` },
    image: posterUrl(x) ?? `${origin}/api/og?kind=page&lang=${lang}`,
    body: `<article><h1>${esc(name)} (${year(x)})</h1><p>${esc(description)}</p>${links ? `<h2>${t.appearsIn}</h2><ul>${links}</ul>` : ""}</article>`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": schemaType(x),
        name,
        url: `${origin}${p}/t/${id}`,
        inLanguage: lang,
        datePublished: x.releaseDate,
        ...(posterUrl(x) ? { image: posterUrl(x) } : {}),
      },
      breadcrumbs(origin, [[lang === "es" ? "Inicio" : "Home", p || "/"], [name, `${p}/t/${id}`]]),
    ],
  };
}

/** Portada en inglés (/en): la española es el index.html estático. */
export function homePage(lang: Lang, origin: string): PageSeo {
  const t = TEXT[lang];
  const p = prefixOf(lang);
  const list = franchiseIds()
    .map(readSeoFranchise)
    .map((f) => `<li><a href="${p}/f/${esc(f.id)}">${esc(localize(f.name, lang))}</a>: ${esc(localize(f.description, lang))}</li>`)
    .join("");
  return {
    title: t.siteTitle,
    description: t.siteDescription,
    path: p || "/",
    alternates: { es: "/", en: "/en" },
    image: `${origin}/api/og?kind=page&lang=${lang}`,
    body: `<section><h1>${esc(t.siteTitle)}</h1><p>${esc(t.siteDescription)}</p><ul>${list}</ul></section>`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Watch Order",
        description: t.siteDescription,
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Any",
        inLanguage: lang,
        url: `${origin}${p || "/"}`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };
}

function breadcrumbs(origin: string, items: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${origin}${path}` })),
  };
}

/** Inserta los metadatos en el HTML de la app (el mismo `index.html` del build). */
export function inject(html: string, seo: PageSeo, lang: Lang, origin: string): string {
  const t = TEXT[lang];
  const url = `${origin}${seo.path}`;
  const alternates = seo.alternates
    ? [
        `<link rel="alternate" hreflang="es" href="${esc(origin + seo.alternates.es)}">`,
        `<link rel="alternate" hreflang="en" href="${esc(origin + seo.alternates.en)}">`,
        `<link rel="alternate" hreflang="x-default" href="${esc(origin + seo.alternates.es)}">`,
      ]
    : [];
  const head = [
    `<link rel="canonical" href="${esc(url)}">`,
    ...alternates,
    seo.noindex ? `<meta name="robots" content="noindex">` : "",
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Watch Order">`,
    `<meta property="og:title" content="${esc(seo.title)}">`,
    `<meta property="og:description" content="${esc(seo.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(seo.image)}">`,
    `<meta property="og:locale" content="${t.locale}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    ...seo.jsonLd.map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, "\\u003c")}</script>`),
  ]
    .filter(Boolean)
    .join("\n    ");
  // Lo de la portada (canonical, Open Graph, JSON-LD y el titular del shell) no aplica a esta página.
  const base = html
    .replace(/\s*<link rel="(?:canonical|alternate)"[^>]*>/g, "")
    .replace(/\s*<meta (?:property="og:|name="twitter:)[^>]*>/g, "")
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")
    .replace(/<section id="shell-hero"[\s\S]*?<\/section>/, "");
  return base
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(seo.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(seo.description)}" />`)
    .replace("</head>", `    ${head}\n  </head>`)
    .replace(/(<main class="flex-1 pb-16">)/, `$1${seo.body}`)
    .replace('<html lang="es">', `<html lang="${lang}">`);
}
