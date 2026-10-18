import type { CatalogIndex } from "./catalogIndex";
import type { Entry, Franchise, Route, Title } from "./types";
import type { ProgressDoc } from "./progressStore";
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

export function routeProgress(
  items: readonly RouteItem[],
  isWatched: IsWatched,
  progress: Readonly<Record<string, ProgressDoc>> = {},
): RouteProgress {
  let watched = 0;
  let remainingMin = 0;
  let unknownRuntime = 0;
  for (const { title, season } of items) {
    if (isWatched(title.id, season)) watched++;
    else if (title.runtimeMin) remainingMin += remainingMinutes(title, season, progress[title.id]);
    else unknownRuntime++;
  }
  return { watched, total: items.length, remainingMin, unknownRuntime };
}

/** Minutos que faltan de una unidad: descuenta los episodios ya marcados (a razón de la serie entera repartida). */
function remainingMinutes(title: Title, season: number | undefined, doc: ProgressDoc | undefined): number {
  const total = title.seasons?.reduce((n, s) => n + s.episodes, 0) ?? 0;
  const perEpisode = total ? (title.runtimeMin ?? 0) / total : 0;
  const seasons = season === undefined ? (title.seasons ?? []) : (title.seasons ?? []).filter((s) => s.number === season);
  if (!total) return season === undefined ? (title.runtimeMin ?? 0) : 0;
  let left = 0;
  for (const s of seasons) {
    const done = new Set(doc?.episodes?.[s.number] ?? []);
    for (let e = 1; e <= s.episodes; e++) if (!done.has(e)) left++;
  }
  return Math.round(left * perEpisode);
}

export const ROUTE_KINDS: Route["kind"][] = ["prep", "character", "theme"];
