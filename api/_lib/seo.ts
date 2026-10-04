// Metadatos y contenido público para buscadores y modelos de IA: la app es una SPA, así que las
// páginas de franquicia y título salen de /api/page con el HTML real (ver api/page.ts).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Lang, LocalizedText } from "../../src/lib/types.js";
import { localize, readData, titleName, titlesById, type ServerTitle } from "./catalog.js";

export interface SeoRoute {
  id: string;
  kind: "character" | "theme" | "prep";
  name: LocalizedText;
  description: LocalizedText;
  /** Títulos de la ruta; "loki-2021#2" es una sola temporada. */
  titleIds: string[];
  targetTitleId?: string;
}

export interface SeoFranchise {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  accentColor: string;
  entries: { titleId: string }[];
  routes: SeoRoute[];
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
    siteDescription: "Sigue sagas y franquicias de cine y TV en el orden que prefieras: estreno, cronológico y rutas. Gratis.",
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
    siteDescription: "Follow movie and TV franchises in the order you like: release, chronological and routes. Free.",
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

/** Textos de la app (src/locales): las páginas de contenido salen de aquí, igual que en el cliente. */
export const readLocale = (lang: Lang) =>
  JSON.parse(readFileSync(join(process.cwd(), "src", "locales", `${lang}.json`), "utf8")) as {
    content: {
      faq: { title: string; description: string; intro: string; items: { q: string; a: string }[] };
      guide: { title: string; description: string; intro: string; sections: { h: string; p: string[] }[] };
      links: { faq: string; guide: string };
    };
    routes: { kinds: Record<string, string> };
  };

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

const ROUTE_TEXT = {
  es: {
    title: (route: string, franchise: string) => `${route} · ${franchise} | Watch Order`,
    description: (desc: string, n: number) => `${desc} ${n} ${n === 1 ? "título" : "títulos"}, en orden y con tu progreso.`,
    titles: "Títulos de la ruta",
    inFranchise: "Más de",
  },
  en: {
    title: (route: string, franchise: string) => `${route} · ${franchise} | Watch Order`,
    description: (desc: string, n: number) => `${desc} ${n} ${n === 1 ? "title" : "titles"}, in order and with your progress.`,
    titles: "Titles in this route",
    inFranchise: "More from",
  },
} as const;

/** Una ruta curada (/f/{franquicia}/r/{ruta}): su descripción y sus títulos, en orden. */
export function routePage(franchiseId: string, routeId: string, lang: Lang, origin: string): PageSeo | undefined {
  const f = readSeoFranchise(franchiseId);
  const route = f.routes.find((r) => r.id === routeId);
  if (!route) return undefined;
  const titles = titlesById();
  const t = ROUTE_TEXT[lang];
  const p = prefixOf(lang);
  const franchiseName = localize(f.name, lang);
  const name = localize(route.name, lang);
  const items = route.titleIds.flatMap((key) => {
    const [titleId, season] = key.split("#");
    const title = titles.get(titleId!);
    return title ? [{ title, season: season ? Number(season) : undefined }] : [];
  });
  const label = (x: { title: ServerTitle; season?: number }) => `${titleName(x.title, lang)}${x.season ? ` · ${lang === "es" ? "Temporada" : "Season"} ${x.season}` : ""}`;
  const description = t.description(localize(route.description, lang), items.length);
  const path = `${p}/f/${franchiseId}/r/${routeId}`;
  return {
    title: t.title(name, franchiseName),
    description,
    path,
    alternates: { es: `/f/${franchiseId}/r/${routeId}`, en: `/en/f/${franchiseId}/r/${routeId}` },
    image: `${origin}/api/og?kind=page&lang=${lang}&f=${franchiseId}`,
    body: `<section><h1>${esc(name)}</h1><p>${esc(description)}</p><h2>${t.titles}</h2><ol>${items
      .map((x) => `<li><a href="${p}/t/${esc(x.title.id)}">${esc(label(x))}</a> (${year(x.title)})</li>`)
      .join("")}</ol><p><a href="${p}/f/${esc(franchiseId)}">${t.inFranchise} ${esc(franchiseName)}</a></p></section>`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name,
        description,
        url: `${origin}${path}`,
        inLanguage: lang,
        numberOfItems: items.length,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        itemListElement: items.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: `${origin}${p}/t/${x.title.id}`, name: label(x) })),
      },
      breadcrumbs(origin, [[lang === "es" ? "Inicio" : "Home", p || "/"], [franchiseName, `${p}/f/${franchiseId}`], [name, path]]),
    ],
  };
}

/** Preguntas frecuentes (con FAQPage) y guía: el mismo texto que las pantallas /faq y /guide. */
export function contentPage(kind: "faq" | "guide", lang: Lang, origin: string): PageSeo {
  const c = readLocale(lang).content;
  const p = prefixOf(lang);
  const page = c[kind];
  const path = `${p}/${kind}`;
  const entries = kind === "faq" ? c.faq.items.map((i) => ({ h: i.q, p: [i.a] })) : c.guide.sections;
  const other = kind === "faq" ? "guide" : "faq";
  return {
    title: `${page.title} | Watch Order`,
    description: page.description,
    path,
    alternates: { es: `/${kind}`, en: `/en/${kind}` },
    image: `${origin}/api/og?kind=page&lang=${lang}`,
    body: `<article><h1>${esc(page.title)}</h1><p>${esc(page.intro)}</p>${entries
      .map((e) => `<section><h2>${esc(e.h)}</h2>${e.p.map((x) => `<p>${esc(x)}</p>`).join("")}</section>`)
      .join("")}<p><a href="${p}/${other}">${esc(c.links[other])}</a></p></article>`,
    jsonLd: [
      ...(kind === "faq"
        ? [
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              inLanguage: lang,
              url: `${origin}${path}`,
              mainEntity: c.faq.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
            },
          ]
        : [{ "@context": "https://schema.org", "@type": "WebPage", name: page.title, description: page.description, inLanguage: lang, url: `${origin}${path}` }]),
      breadcrumbs(origin, [[lang === "es" ? "Inicio" : "Home", p || "/"], [page.title, path]]),
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
    // Una página que no existe (404, noindex) no tiene versión canónica ni paralela.
    seo.noindex ? "" : `<link rel="canonical" href="${esc(url)}">`,
    ...(seo.noindex ? [] : alternates),
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
