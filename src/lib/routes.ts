import type { CatalogIndex } from "./catalogIndex";
import type { Entry, Franchise, Route, Title } from "./types";
import { parseUnitKey, unitKey, unitReleaseDate, type IsWatched } from "./units";

// Rutas (SPEC §4.4): listas de títulos con un propósito — un personaje, un tema o
// "Prepárate para…". Pueden cruzar franquicias.

export interface RouteItem {
  title: Title;
  /** Si la ruta nombra una sola temporada ("loki-2021#2"). */
  season?: number;
  key: string;
  releaseDate: string;
  /** Pertenencia del título: la de la franquicia de la ruta o, si no está ahí, la primera. */
  entry?: Entry;
  position: number;
}

export function resolveRoute(route: Route, franchise: Franchise, index: CatalogIndex): RouteItem[] {
  return route.titleIds.flatMap((key, i) => {
    const { titleId, season } = parseUnitKey(key);
    const title = index.titlesById.get(titleId);
    if (!title) return [];
    // La entry de esa temporada si la hay; si no, la del título (o la primera de sus temporadas).
    const appearances = (index.franchisesByTitle.get(titleId) ?? []).filter((a) => season === undefined || a.entry.season === undefined || a.entry.season === season);
    const entry = (appearances.find((a) => a.franchise.id === franchise.id) ?? appearances[0])?.entry;
    return [{ title, season, key: unitKey(titleId, season), releaseDate: unitReleaseDate(title, season), entry, position: i + 1 }];
  });
}

export interface RouteProgress {
  watched: number;
  total: number;
  /** Minutos que faltan por ver (títulos sin duración conocida no suman). */
  remainingMin: number;
  unknownRuntime: number;
}

export function routeProgress(items: readonly RouteItem[], isWatched: IsWatched): RouteProgress {
  let watched = 0;
  let remainingMin = 0;
  let unknownRuntime = 0;
  for (const { title, season } of items) {
    if (isWatched(title.id, season)) watched++;
    else if (title.runtimeMin) remainingMin += season === undefined ? title.runtimeMin : seasonMinutes(title, season);
    else unknownRuntime++;
  }
  return { watched, total: items.length, remainingMin, unknownRuntime };
}

/** Duración estimada de una temporada: la de la serie repartida por episodios. */
function seasonMinutes(title: Title, season: number): number {
  const total = title.seasons?.reduce((n, s) => n + s.episodes, 0) ?? 0;
  const episodes = title.seasons?.find((s) => s.number === season)?.episodes ?? 0;
  return total ? Math.round(((title.runtimeMin ?? 0) * episodes) / total) : 0;
}

export const ROUTE_KINDS: Route["kind"][] = ["prep", "character", "theme"];
