import { VIEWING_FORMATS, VIEWING_MEDIUMS, type Viewing, type ViewingFormat, type ViewingMedium } from "./progressStore";
import type { Kind } from "./types";

// Qué se puede registrar de cada visualización depende del tipo de título: una película se
// ve en cine (con formatos como IMAX o 4DX); una serie, en streaming o TV, por temporadas.

export interface ViewingOptions {
  mediums: readonly ViewingMedium[];
  formats: readonly ViewingFormat[];
  /** Se puede indicar qué temporada se vio. */
  seasons: boolean;
}

const LANGUAGE: readonly ViewingFormat[] = ["dubbed", "subbed"];

export function viewingOptions(kind: Kind, hasSeasons: boolean): ViewingOptions {
  if (kind === "movie") return { mediums: ["cinema", "streaming", "tv", "other"], formats: VIEWING_FORMATS, seasons: false };
  return { mediums: ["streaming", "tv", "other"], formats: LANGUAGE, seasons: kind === "series" && hasSeasons };
}

/** Deja solo los campos válidos de una visualización; undefined si no queda ninguno. */
export function cleanViewing(raw: unknown): Viewing | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Partial<Record<keyof Viewing, unknown>>;
  const formats = Array.isArray(v.formats) ? VIEWING_FORMATS.filter((f) => (v.formats as unknown[]).includes(f)) : [];
  const out: Viewing = {
    ...(typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? { date: v.date } : {}),
    ...(typeof v.place === "string" && v.place.trim() ? { place: v.place.trim().slice(0, 100) } : {}),
    ...(VIEWING_MEDIUMS.includes(v.medium as never) ? { medium: v.medium as ViewingMedium } : {}),
    ...(formats.length ? { formats } : {}),
    ...(Number.isInteger(v.season) && (v.season as number) > 0 ? { season: v.season as number } : {}),
    ...(typeof v.note === "string" && v.note.trim() ? { note: v.note.trim().slice(0, 500) } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

/** Las visualizaciones válidas de un documento (lista, o la única del formato anterior). */
export function cleanViewings(raw: { viewings?: unknown; viewing?: unknown }): Viewing[] {
  const list = Array.isArray(raw.viewings) ? raw.viewings : raw.viewing ? [raw.viewing] : [];
  return list.flatMap((v) => cleanViewing(v) ?? []);
}
