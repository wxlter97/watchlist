import type { CatalogIndex, RouteRef } from "./catalogIndex";
import type { Franchise, Lang, LocalizedText, Title } from "./types";

// Búsqueda global (SPEC §8.5): títulos, franquicias y rutas, en cualquier idioma,
// sin importar mayúsculas, acentos ni puntuación.

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

const texts = (t: LocalizedText): string[] => (typeof t === "string" ? [t] : Object.values(t).filter(Boolean) as string[]);

/**
 * 0 = coincidencia exacta, 1 = empieza igual, 2 = alguna palabra empieza igual,
 * 3 = contiene todas las palabras; null = no coincide.
 */
export function matchScore(haystacks: readonly string[], query: string): number | null {
  const q = normalize(query);
  if (!q) return null;
  const tokens = q.split(" ");
  let best: number | null = null;
  for (const raw of haystacks) {
    const h = normalize(raw);
    if (!tokens.every((tok) => h.includes(tok))) continue;
    const score = h === q ? 0 : h.startsWith(q) ? 1 : ` ${h}`.includes(` ${q}`) ? 2 : 3;
    if (best === null || score < best) best = score;
  }
  return best;
}

export interface SearchResults {
  titles: Title[];
  franchises: Franchise[];
  routes: RouteRef[];
}

export function searchCatalog(index: CatalogIndex, query: string, lang: Lang, limit = 60): SearchResults {
  const rank = <T,>(items: Iterable<T>, haystacks: (item: T) => string[], tiebreak: (a: T, b: T) => number) =>
    [...items]
      .map((item) => ({ item, score: matchScore(haystacks(item), query) }))
      .filter((x): x is { item: T; score: number } => x.score !== null)
      .sort((a, b) => a.score - b.score || tiebreak(a.item, b.item))
      .map((x) => x.item);

  const titles = rank(
    index.titlesById.values(),
    (t) => [t.localized?.[lang]?.title, t.title, ...Object.values(t.localized ?? {}).map((l) => l?.title)].filter(Boolean) as string[],
    (a, b) => a.releaseDate.localeCompare(b.releaseDate),
  ).slice(0, limit);

  const franchises = rank(index.franchisesById.values(), (f) => [...texts(f.name), f.id], () => 0);

  const allRoutes = [...index.franchisesById.values()].flatMap((franchise) => franchise.routes.map((route) => ({ franchise, route })));
  const routes = rank(allRoutes, (r) => texts(r.route.name), () => 0).slice(0, 12);

  return { titles, franchises, routes };
}
