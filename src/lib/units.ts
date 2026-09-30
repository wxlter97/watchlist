import type { ProgressDoc } from "./progressStore";
import type { Title } from "./types";

// Una unidad de un orden: un título completo o una temporada de una serie. Las series se
// pueden repartir por temporada en los órdenes (la T2 de Loki va años después de la T1),
// pero el progreso sigue siendo del título: una temporada está vista si el título está
// visto o si todos sus episodios están marcados.

/** "loki-2021" o "loki-2021#2". Es lo que guardan los órdenes curados, personalizados y las rutas. */
export const unitKey = (titleId: string, season?: number) => (season === undefined ? titleId : `${titleId}#${season}`);

export function parseUnitKey(key: string): { titleId: string; season?: number } {
  const i = key.lastIndexOf("#");
  if (i === -1) return { titleId: key };
  const season = Number(key.slice(i + 1));
  return Number.isInteger(season) && season > 0 ? { titleId: key.slice(0, i), season } : { titleId: key };
}

export const seasonOf = (title: Title, season: number) => title.seasons?.find((s) => s.number === season);

/**
 * Estreno de la unidad: el de la temporada si lo hay (TMDB), si no el del título. Una
 * temporada posterior sin fecha de una serie en emisión es un anuncio: todavía no se estrena.
 */
export function unitReleaseDate(title: Title, season?: number): string {
  if (season === undefined) return title.releaseDate;
  const airDate = seasonOf(title, season)?.airDate;
  if (airDate) return airDate;
  return season > 1 && title.ongoing ? "9999-12-31" : title.releaseDate;
}

export const isUnitReleased = (title: Title, season: number | undefined, today: string) => unitReleaseDate(title, season) <= today;

/**
 * ¿Está vista la unidad? `seasonEpisodes` es el número de episodios de la temporada (hace
 * falta cuando el título no está marcado como visto entero).
 */
export function isUnitWatched(doc: ProgressDoc | undefined, season?: number, seasonEpisodes?: number): boolean {
  if (!doc) return false;
  if (doc.status === "watched") return true;
  if (season === undefined || !seasonEpisodes) return false;
  return (doc.episodes?.[season]?.length ?? 0) >= seasonEpisodes;
}

/** Predicado de "visto" por título y, opcionalmente, temporada. */
export type IsWatched = (titleId: string, season?: number) => boolean;

/** El predicado para un progreso, con los títulos para saber cuántos episodios tiene cada temporada. */
export function watchedPredicate(
  progress: Readonly<Record<string, ProgressDoc>>,
  titlesById: ReadonlyMap<string, Title>,
): IsWatched {
  return (titleId, season) => {
    const doc = progress[titleId];
    if (season === undefined || doc?.status === "watched") return isUnitWatched(doc, season);
    const title = titlesById.get(titleId);
    return isUnitWatched(doc, season, title && seasonOf(title, season)?.episodes);
  };
}
