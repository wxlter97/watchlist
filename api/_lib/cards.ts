// Tarjetas compartibles (SPEC §9.4) como árboles de elementos para satori. Sin JSX: el
// helper `h` arma los mismos objetos que React.createElement.
import { ACHIEVEMENT_ICONS, ICON_STROKE } from "../../src/lib/achievementIcons";
import { onColor } from "../../src/lib/color";
import type { Lang } from "../../src/lib/types";

export interface El {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
}

type Child = El | string | number | null | false | undefined;

export function h(type: string, props: Record<string, unknown> | null, ...children: Child[]): El {
  const kids = children.filter((c) => c !== null && c !== false && c !== undefined);
  return { type, props: { ...props, children: kids.length === 1 ? kids[0] : kids } };
}

export const SIZE = 1080;
const TINTA = "#111111";
const FARO = "#FFDB00";
const ON_INK = "#EDEDE7";
const ON_INK_DIM = "#8A8A80";
const PAD = 72;

const STRINGS = {
  es: {
    achievement: "Logro desbloqueado",
    franchise: "Franquicia completada",
    stats: "Mis números",
    wrapped: (y: number) => `Mi ${y} en Watch Order`,
    hours: "horas vistas",
    titles: "títulos",
    rating: "calificación promedio",
    topFranchise: "franquicia favorita",
    franchiseOfYear: "Franquicia del año",
    topTitle: "Mejor calificado",
    topMonth: "Mes más activo",
    achievements: "Logros del año",
    footer: "Watch Order · por wxlter",
  },
  en: {
    achievement: "Achievement unlocked",
    franchise: "Franchise completed",
    stats: "My numbers",
    wrapped: (y: number) => `My ${y} on Watch Order`,
    hours: "hours watched",
    titles: "titles",
    rating: "average rating",
    topFranchise: "favorite franchise",
    franchiseOfYear: "Franchise of the year",
    topTitle: "Top rated",
    topMonth: "Most active month",
    achievements: "Achievements this year",
    footer: "Watch Order · by wxlter",
  },
} as const;

const fmt = (lang: Lang, n: number) => new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US", { maximumFractionDigits: 1 }).format(n);

function icon(id: string, size: number, color: string): El {
  const shapes = (ACHIEVEMENT_ICONS[id] ?? ACHIEVEMENT_ICONS.star!).map((s) => {
    if (s.tag === "rect") return h("rect", { x: s.x, y: s.y, width: s.width, height: s.height, fill: color });
    const paint =
      s.mode === "fill"
        ? { fill: color }
        : { fill: "none", stroke: color, strokeWidth: ICON_STROKE, strokeLinecap: "square", strokeLinejoin: "miter" };
    return s.tag === "path" ? h("path", { d: s.d, ...paint }) : h("circle", { cx: s.cx, cy: s.cy, r: s.r, ...paint });
  });
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24" }, ...shapes);
}

/** Marco común: marca arriba, contenido al centro, pie abajo. */
function frame(lang: Lang, bg: string, fg: string, content: El): El {
  const dim = bg === TINTA ? ON_INK_DIM : fg === TINTA ? "rgba(17,17,17,0.7)" : "rgba(255,255,255,0.8)";
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: SIZE,
        height: SIZE,
        padding: PAD,
        background: bg,
        color: fg,
        fontFamily: "Archivo",
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 20 } },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            background: FARO,
            color: TINTA,
            fontFamily: "Archivo Black",
            fontSize: 38,
            border: bg === FARO ? `3px solid ${TINTA}` : "none",
          },
        },
        "O",
      ),
      h("div", { style: { fontFamily: "Archivo Black", fontSize: 36, letterSpacing: -1 } }, "Watch Order"),
    ),
    h("div", { style: { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" } }, content),
    h(
      "div",
      { style: { display: "flex", fontFamily: "JetBrains Mono", fontSize: 24, color: dim, letterSpacing: 2, textTransform: "uppercase" } },
      STRINGS[lang].footer,
    ),
  );
}

const label = (text: string, color: string) =>
  h(
    "div",
    { style: { display: "flex", fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color } },
    text,
  );

const display = (text: string, size: number, color?: string) =>
  h("div", { style: { display: "flex", fontFamily: "Archivo Black", fontSize: size, lineHeight: 1.02, letterSpacing: -2, color } }, text);

/** Tamaño de título que cabe en el ancho según el largo del texto. */
const fit = (text: string, max: number) => Math.max(56, Math.min(max, Math.floor(1700 / Math.max(8, text.length)) * 1.9));

export function achievementCard(lang: Lang, a: { name: string; description: string; icon: string }, date?: string): El {
  return frame(
    lang,
    TINTA,
    ON_INK,
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 36 } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "center", width: 240, height: 240, background: FARO } },
        icon(a.icon, 150, TINTA),
      ),
      label(STRINGS[lang].achievement, FARO),
      display(a.name, fit(a.name, 110)),
      h("div", { style: { display: "flex", fontSize: 38, lineHeight: 1.35, color: "#CFCFC7", maxWidth: 880 } }, a.description),
      date ? h("div", { style: { display: "flex", fontFamily: "JetBrains Mono", fontSize: 26, color: ON_INK_DIM } }, date) : null,
    ),
  );
}

export function franchiseCard(lang: Lang, f: { name: string; accent: string }, titles: number, hours: number): El {
  const fg = onColor(f.accent);
  const s = STRINGS[lang];
  return frame(
    lang,
    f.accent,
    fg,
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 40 } },
      label(s.franchise, fg),
      display(f.name, fit(f.name, 150)),
      h(
        "div",
        { style: { display: "flex", gap: 56, borderTop: `4px solid ${fg}`, paddingTop: 36 } },
        stat(fmt(lang, titles), s.titles, fg),
        stat(fmt(lang, hours), s.hours, fg),
      ),
    ),
  );
}

function stat(value: string, caption: string, color: string): El {
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 6 } },
    display(value, 96, color),
    h("div", { style: { display: "flex", fontFamily: "JetBrains Mono", fontSize: 24, letterSpacing: 2, textTransform: "uppercase", color } }, caption),
  );
}

function row(caption: string, value: string): El {
  return h(
    "div",
    { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 32, borderTop: `3px solid ${ON_INK}`, paddingTop: 18 } },
    h("div", { style: { display: "flex", fontFamily: "JetBrains Mono", fontSize: 24, letterSpacing: 2, textTransform: "uppercase", color: ON_INK_DIM } }, caption),
    h("div", { style: { display: "flex", fontWeight: 700, fontSize: 38, textAlign: "right", maxWidth: 560 } }, value),
  );
}

function bigHours(lang: Lang, hours: number): El {
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column" } },
    h("div", { style: { display: "flex", fontFamily: "Archivo Black", fontSize: 220, lineHeight: 0.95, letterSpacing: -8, color: FARO } }, fmt(lang, hours)),
    h("div", { style: { display: "flex", fontFamily: "JetBrains Mono", fontSize: 30, letterSpacing: 3, textTransform: "uppercase" } }, STRINGS[lang].hours),
  );
}

export function statsCard(lang: Lang, d: { hours: number; titles: number; rating?: number; franchise?: string }): El {
  const s = STRINGS[lang];
  return frame(
    lang,
    TINTA,
    ON_INK,
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 44 } },
      label(s.stats, FARO),
      bigHours(lang, d.hours),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 20 } },
        row(s.titles, fmt(lang, d.titles)),
        d.rating !== undefined ? row(s.rating, `${fmt(lang, d.rating)} / 5`) : null,
        d.franchise ? row(s.topFranchise, d.franchise) : null,
      ),
    ),
  );
}

export function wrappedCard(
  lang: Lang,
  d: { year: number; hours: number; titles: number; franchise?: string; topTitle?: string; month?: string; achievements: number },
): El {
  const s = STRINGS[lang];
  return frame(
    lang,
    TINTA,
    ON_INK,
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 40 } },
      label(s.wrapped(d.year), FARO),
      bigHours(lang, d.hours),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 18 } },
        row(s.titles, fmt(lang, d.titles)),
        d.franchise ? row(s.franchiseOfYear, d.franchise) : null,
        d.topTitle ? row(s.topTitle, d.topTitle) : null,
        d.month ? row(s.topMonth, d.month) : null,
        row(s.achievements, fmt(lang, d.achievements)),
      ),
    ),
  );
}
