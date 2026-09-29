import type { CatalogIndex } from "./catalogIndex";
import type { Entry, Franchise, Route, Title } from "./types";

// Rutas (SPEC §4.4): listas de títulos con un propósito — un personaje, un tema o
// "Prepárate para…". Pueden cruzar franquicias.

export interface RouteItem {
  title: Title;
  /** Pertenencia del título: la de la franquicia de la ruta o, si no está ahí, la primera. */
  entry?: Entry;
  position: number;
}

export function resolveRoute(route: Route, franchise: Franchise, index: CatalogIndex): RouteItem[] {
  return route.titleIds.flatMap((id, i) => {
    const title = index.titlesById.get(id);
    if (!title) return [];
    const appearances = index.franchisesByTitle.get(id) ?? [];
    const entry = (appearances.find((a) => a.franchise.id === franchise.id) ?? appearances[0])?.entry;
    return [{ title, entry, position: i + 1 }];
  });
}

export interface RouteProgress {
  watched: number;
  total: number;
  /** Minutos que faltan por ver (títulos sin duración conocida no suman). */
  remainingMin: number;
  unknownRuntime: number;
}

export function routeProgress(items: readonly RouteItem[], isWatched: (id: string) => boolean): RouteProgress {
  let watched = 0;
  let remainingMin = 0;
  let unknownRuntime = 0;
  for (const { title } of items) {
    if (isWatched(title.id)) watched++;
    else if (title.runtimeMin) remainingMin += title.runtimeMin;
    else unknownRuntime++;
  }
  return { watched, total: items.length, remainingMin, unknownRuntime };
}

export const ROUTE_KINDS: Route["kind"][] = ["prep", "character", "theme"];
