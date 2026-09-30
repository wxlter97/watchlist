import type { OrderedItem } from "./orders";
import type { Franchise, Importance, Kind } from "./types";
import type { IsWatched } from "./units";

// Filtros de la vista de franquicia (SPEC §8.2). Se aplican después de calcular el orden,
// así la posición de cada título no cambia al filtrar.

export type StatusFilter = "all" | "pending" | "watched";

export interface Filters {
  kinds: Kind[];
  importance: Importance[];
  status: StatusFilter;
  character?: string;
  team?: string;
}

export const NO_FILTERS: Filters = { kinds: [], importance: [], status: "all" };

export function applyFilters(
  items: readonly OrderedItem[],
  f: Filters,
  isWatched: IsWatched,
): OrderedItem[] {
  return items.filter(({ title, entry, season }) => {
    if (f.kinds.length && !f.kinds.includes(title.kind)) return false;
    if (f.importance.length && !f.importance.includes(entry.importance)) return false;
    if (f.status === "watched" && !isWatched(title.id, season)) return false;
    if (f.status === "pending" && isWatched(title.id, season)) return false;
    if (f.character && !entry.characters?.includes(f.character)) return false;
    if (f.team && !entry.teams?.includes(f.team)) return false;
    return true;
  });
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.kinds.length ? 1 : 0) +
    (f.importance.length ? 1 : 0) +
    (f.status !== "all" ? 1 : 0) +
    (f.character ? 1 : 0) +
    (f.team ? 1 : 0)
  );
}

/**
 * Continuidades ocultas. El perfil guarda solo excepciones a los valores por defecto
 * (`hidden`: visibles por defecto que ocultó; `shown`: ocultas por defecto que activó),
 * así una continuidad agregada después al catálogo respeta su propio valor por defecto.
 */
export function effectiveHidden(
  franchise: Pick<Franchise, "continuities">,
  hidden: readonly string[] = [],
  shown: readonly string[] = [],
): string[] {
  return franchise.continuities
    .filter((c) => (c.hiddenByDefault ? !shown.includes(c.id) : hidden.includes(c.id)))
    .map((c) => c.id);
}

/** Excepciones nuevas tras alternar una continuidad. */
export function toggleContinuity(
  franchise: Franchise,
  continuityId: string,
  hidden: readonly string[] = [],
  shown: readonly string[] = [],
): { hiddenContinuities: string[]; shownContinuities: string[] } {
  const flip = (list: readonly string[]) =>
    list.includes(continuityId) ? list.filter((id) => id !== continuityId) : [...list, continuityId];
  const byDefault = franchise.continuities.find((c) => c.id === continuityId)?.hiddenByDefault;
  return byDefault
    ? { hiddenContinuities: hidden.filter((id) => id !== continuityId), shownContinuities: flip(shown) }
    : { hiddenContinuities: flip(hidden), shownContinuities: shown.filter((id) => id !== continuityId) };
}

/** Tipos presentes en la franquicia, en un orden estable, para no ofrecer filtros vacíos. */
export function kindsIn(franchise: Franchise, kindOf: (titleId: string) => Kind | undefined): Kind[] {
  const order: Kind[] = ["movie", "series", "special", "short", "one-shot", "ova"];
  const present = new Set(franchise.entries.map((e) => kindOf(e.titleId)));
  return order.filter((k) => present.has(k));
}
