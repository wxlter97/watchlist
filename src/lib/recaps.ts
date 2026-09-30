import type { CatalogIndex } from "./catalogIndex";
import { effectiveHidden } from "./filters";
import { computeOrder, resolveOrder } from "./orders";
import type { FranchiseStateDoc, ProgressDoc } from "./progressStore";
import type { Lang } from "./types";

// Recaps sin spoilers (SPEC §9.3): "lo que necesitas recordar" antes de ver un título se arma
// con los recaps de los títulos previos que ya viste, nunca de los que no. Los textos viven en
// src/data/recaps/{lang}/{titleId}.md y se cargan bajo demanda.

const loaders = import.meta.glob<string>("../data/recaps/*/*.md", { query: "?raw", import: "default" });

const key = (lang: Lang, titleId: string) => `../data/recaps/${lang}/${titleId}.md`;

export function hasRecap(lang: Lang, titleId: string): boolean {
  return key(lang, titleId) in loaders;
}

export function loadRecap(lang: Lang, titleId: string): Promise<string> | undefined {
  return loaders[key(lang, titleId)]?.();
}

/** Todos los ids con recap en un idioma (para el validador). */
export function recapIds(lang: Lang): string[] {
  const prefix = `../data/recaps/${lang}/`;
  return Object.keys(loaders)
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length, -3));
}

/**
 * Títulos previos a `titleId`, en el orden activo de su franquicia, que el perfil ya vio y
 * tienen recap. El más cercano al final.
 */
export function recapsBefore(
  titleId: string,
  ctx: {
    index: CatalogIndex;
    progress: Readonly<Record<string, ProgressDoc>>;
    franchiseState: Readonly<Record<string, FranchiseStateDoc>>;
    has: (titleId: string) => boolean;
  },
): string[] {
  const appearances = ctx.index.franchisesByTitle.get(titleId) ?? [];
  // La franquicia en la que el perfil ya eligió un orden; si no, la primera.
  const home = appearances.find((a) => ctx.franchiseState[a.franchise.id]?.lastOrderId) ?? appearances[0];
  if (!home) return [];
  const { franchise } = home;
  const state = ctx.franchiseState[franchise.id];
  const order = resolveOrder(franchise, state?.lastOrderId, state?.customOrder);
  const hiddenContinuities = effectiveHidden(franchise, state?.hiddenContinuities, state?.shownContinuities);
  let items = computeOrder(franchise, order, ctx.index.titlesById, { hiddenContinuities });
  // Un orden curado puede no incluir el título: entonces se usa el cronológico.
  if (!items.some((i) => i.title.id === titleId)) {
    const chrono = franchise.orders.find((o) => o.type === "chronological")?.id;
    items = computeOrder(franchise, resolveOrder(franchise, chrono), ctx.index.titlesById, { hiddenContinuities });
  }
  const at = items.findIndex((i) => i.title.id === titleId);
  if (at <= 0) return [];
  // Un recap es de la serie entera: se muestra con la serie vista, una sola vez.
  return [...new Set(items.slice(0, at).map((i) => i.title.id))].filter(
    (id) => id !== titleId && ctx.progress[id]?.status === "watched" && ctx.has(id),
  );
}
