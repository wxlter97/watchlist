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
      links: Record<ContentKind, string>;
    } & Record<Exclude<ContentKind, "faq">, ContentSections>;
    legal: { updated: string; privacyLink: string; termsLink: string } & Record<"privacy" | "terms", { title: string; sections: Section[] }>;
    routes: { kinds: Record<string, string> };
    hub: { franchises: string };
  };

interface Section {
  id?: string;
  h: string;
  p: string[];
  code?: string;
}
interface ContentSections {
  title: string;
  description: string;
  intro: string;
  sections: Section[];
}

/** Páginas de contenido (src/features/content/ContentPage.tsx): mismo texto y mismo link al pie. */
export type ContentKind = "faq" | "guide" | "about" | "contact" | "developers";
export const CONTENT_KINDS: ContentKind[] = ["faq", "guide", "about", "contact", "developers"];
const NEXT_PAGE: Record<ContentKind, ContentKind> = { faq: "guide", guide: "faq", about: "contact", contact: "developers", developers: "about" };

/** Texto escapado, con el correo como link (igual que en ContentPage). */
const linkify = (text: string) => esc(text).replace(/([\w.+-]+@[\w-]+\.[\w.]+\w)/g, '<a href="mailto:$1">$1</a>');

function sectionsHtml(sections: Section[]): string {
  return sections
    .map(
      (e) =>
        `<section${e.id ? ` id="${esc(e.id)}"` : ""}><h2>${esc(e.h)}</h2>${e.p.map((x) => `<p>${linkify(x)}</p>`).join("")}${
          e.code ? `<pre><code>${esc(e.code)}</code></pre>` : ""
        }</section>`,
    )
    .join("");
}

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

/** Preguntas frecuentes (con FAQPage), guía, acerca de, contacto y la API: el mismo texto que las pantallas. */
export function contentPage(kind: ContentKind, lang: Lang, origin: string): PageSeo {
  const c = readLocale(lang).content;
  const p = prefixOf(lang);
  const path = `${p}/${kind}`;
  const page = kind === "faq" ? c.faq : c[kind];
  const sections: Section[] = kind === "faq" ? c.faq.items.map((i) => ({ h: i.q, p: [i.a] })) : c[kind].sections;
  const other = NEXT_PAGE[kind];
  const schema =
    kind === "faq"
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: lang,
          url: `${origin}${path}`,
          mainEntity: c.faq.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
        }
      : {
          "@context": "https://schema.org",
          "@type": kind === "about" ? "AboutPage" : kind === "contact" ? "ContactPage" : "WebPage",
          name: page.title,
          description: page.description,
          inLanguage: lang,
          url: `${origin}${path}`,
          ...(kind === "about" || kind === "contact" ? { about: organization(origin) } : {}),
        };
  return {
    title: `${page.title} | Watch Order`,
    description: page.description,
    path,
    alternates: { es: `/${kind}`, en: `/en/${kind}` },
    image: `${origin}/api/og?kind=page&lang=${lang}`,
    body: `<article><h1>${esc(page.title)}</h1><p>${linkify(page.intro)}</p>${sectionsHtml(sections)}<p><a href="${p}/${other}">${esc(c.links[other])}</a></p></article>`,
    jsonLd: [schema, breadcrumbs(origin, [[lang === "es" ? "Inicio" : "Home", p || "/"], [page.title, path]])],
  };
}

/** /privacy y /terms (src/features/legal/LegalPage.tsx): el texto de legal.* en locales/. */
export function legalPage(kind: "privacy" | "terms", lang: Lang, origin: string): PageSeo {
  const l = readLocale(lang).legal;
  const p = prefixOf(lang);
  const path = `${p}/${kind}`;
  const page = l[kind];
  const description = `${page.title} — Watch Order. ${l.updated}.`;
  return {
    title: `${page.title} | Watch Order`,
    description,
    path,
    alternates: { es: `/${kind}`, en: `/en/${kind}` },
    image: `${origin}/api/og?kind=page&lang=${lang}`,
    body: `<article><h1>${esc(page.title)}</h1><p>${esc(l.updated)}</p>${sectionsHtml(page.sections)}<p><a href="${p}/${kind === "privacy" ? "terms" : "privacy"}">${esc(
      kind === "privacy" ? l.termsLink : l.privacyLink,
    )}</a></p></article>`,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "WebPage", name: page.title, description, inLanguage: lang, url: `${origin}${path}` },
      breadcrumbs(origin, [[lang === "es" ? "Inicio" : "Home", p || "/"], [page.title, path]]),
    ],
  };
}

/** Quién está detrás (JSON-LD Organization): la portada, acerca de y contacto. */
export function organization(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: "Watch Order",
    url: `${origin}/`,
    logo: `${origin}/pwa-512.png`,
    description: TEXT.en.siteDescription,
    email: "work@wxlter.dev",
    founder: { "@type": "Person", name: "wxlter", url: "https://wxlter.dev" },
    contactPoint: [
      { "@type": "ContactPoint", contactType: "customer support", email: "work@wxlter.dev", availableLanguage: ["es", "en"], url: `${origin}/contact` },
    ],
  };
}

const HOME_TEXT = {
  es: {
    intro:
      "Watch Order es una app web gratuita para saber en qué orden ver sagas y franquicias de cine y TV: por fecha de estreno, cronológico, curado o el tuyo. Trae rutas por personaje y tema, y rutas «Prepárate para…» con lo mínimo antes de un estreno; marca qué es esencial, guarda tu progreso, planifica maratones y funciona sin conexión.",
    more: "Más",
    links: [
      ["/guide", "Cómo funciona"],
      ["/faq", "Preguntas frecuentes"],
      ["/about", "Acerca de"],
      ["/contact", "Contacto"],
      ["/developers", "API para desarrolladores"],
    ],
  },
  en: {
    intro:
      "Watch Order is a free web app to know what order to watch movie and TV franchises in: by release date, chronological, curated or your own. It has routes by character and theme, and “Get ready for…” routes with the minimum before a release; it marks what is essential, keeps your progress, plans marathons and works offline.",
    more: "More",
    links: [
      ["/guide", "How it works"],
      ["/faq", "FAQ"],
      ["/about", "About"],
      ["/contact", "Contact"],
      ["/developers", "Developer API"],
    ],
  },
} as const;

/**
 * Contenido de la portada sin el titular: presentación, franquicias y links. Va en la portada
 * de api/page.ts y, al compilar, en el index.html estático (vite.config.ts), para quien no
 * ejecuta JavaScript. `descriptions: false` deja solo los nombres (el index.html es el shell de toda la app).
 */
export function homeSections(lang: Lang, { descriptions = true } = {}): string {
  const h = HOME_TEXT[lang];
  const p = prefixOf(lang);
  const list = franchiseIds()
    .map(readSeoFranchise)
    .map((f) => `<li><a href="${p}/f/${esc(f.id)}">${esc(localize(f.name, lang))}</a>${descriptions ? `: ${esc(localize(f.description, lang))}` : ""}</li>`)
    .join("");
  const links = [...h.links.map(([href, label]) => `<li><a href="${p}${href}">${esc(label)}</a></li>`), `<li><a href="/llms.txt">llms.txt</a></li>`, `<li><a href="/openapi.json">OpenAPI</a></li>`].join("");
  return `<p>${esc(h.intro)}</p><h2>${esc(readLocale(lang).hub.franchises)}</h2><ul>${list}</ul><h2>${h.more}</h2><ul>${links}</ul>`;
}

/** Portada: la española es el index.html estático (y esta, para Markdown); la inglesa, /en. */
export function homePage(lang: Lang, origin: string): PageSeo {
  const t = TEXT[lang];
  const p = prefixOf(lang);
  return {
    title: t.siteTitle,
    description: t.siteDescription,
    path: p || "/",
    alternates: { es: "/", en: "/en" },
    image: `${origin}/api/og?kind=page&lang=${lang}`,
    body: `<section><h1>${esc(t.siteTitle)}</h1>${homeSections(lang)}</section>`,
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
        publisher: { "@id": `${origin}/#organization` },
      },
      organization(origin),
    ],
  };
}

const NOT_FOUND_TEXT = {
  es: {
    h1: "No encontramos esta página",
    p: (path: string) => `No existe ninguna página en ${path}. El link puede estar mal escrito o la página ya no existe.`,
    find: "Para encontrar lo que buscas:",
    links: [
      ["/", "Portada y todas las franquicias"],
      ["/sitemap.xml", "Mapa del sitio"],
      ["/llms.txt", "llms.txt (resumen para agentes de IA)"],
      ["/developers", "API para desarrolladores"],
    ],
  },
  en: {
    h1: "We couldn't find this page",
    p: (path: string) => `There is no page at ${path}. The link may be mistyped, or the page may no longer exist.`,
    find: "To find what you are looking for:",
    links: [
      ["/en", "Home and every franchise"],
      ["/sitemap.xml", "Sitemap"],
      ["/llms.txt", "llms.txt (summary for AI agents)"],
      ["/developers", "Developer API"],
    ],
  },
} as const;

/** Una ruta que no existe (404, noindex): qué pasó y adónde ir, también en Markdown. */
export function notFoundPage(pathname: string, lang: Lang, origin: string): PageSeo {
  const t = NOT_FOUND_TEXT[lang];
  const path = pathname.slice(0, 200);
  return {
    title: TEXT[lang].notFound,
    description: TEXT[lang].siteDescription,
    path,
    image: `${origin}/api/og?kind=page&lang=${lang}`,
    body: `<section><h1>${esc(t.h1)}</h1><p>${esc(t.p(path))}</p><p>${esc(t.find)}</p><ul>${t.links
      .map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`)
      .join("")}</ul></section>`,
    jsonLd: [],
    noindex: true,
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
  // Lo de la portada (canonical, Open Graph, JSON-LD, el titular y el contenido del shell) no aplica a esta página.
  const base = html
    .replace(/\s*<link rel="(?:canonical|alternate)"[^>]*>/g, "")
    .replace(/\s*<meta (?:property="og:|name="twitter:)[^>]*>/g, "")
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")
    .replace(/<section id="shell-hero"[\s\S]*?<\/section>/, "")
    .replace(/<section id="shell-home"[\s\S]*?<\/section>/, "");
  return base
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(seo.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(seo.description)}" />`)
    .replace("</head>", `    ${head}\n  </head>`)
    .replace(/(<main class="flex-1 pb-16">)/, `$1${seo.body}`)
    .replace('<html lang="es">', `<html lang="${lang}">`);
}
