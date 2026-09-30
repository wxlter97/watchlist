import type { OrderedItem } from "./orders";
import type { Title } from "./types";
import type { IsWatched } from "./units";

/** Fecha local de hoy en ISO (YYYY-MM-DD), comparable con releaseDate. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isReleased(title: Title, today = todayIso()): boolean {
  return title.releaseDate <= today;
}

export interface ProgressSummary {
  watched: number;
  /** Títulos ya estrenados: la base del porcentaje. */
  total: number;
  upcoming: number;
  ratio: number;
}

export function summarize(
  items: readonly Pick<OrderedItem, "title" | "season" | "releaseDate">[],
  isWatched: IsWatched,
  today = todayIso(),
): ProgressSummary {
  let watched = 0;
  let total = 0;
  let upcoming = 0;
  // Cada temporada repartida en el orden cuenta como una unidad.
  for (const { title, season, releaseDate } of items) {
    if (releaseDate <= today) {
      total++;
      if (isWatched(title.id, season)) watched++;
    } else {
      upcoming++;
    }
  }
  return { watched, total, upcoming, ratio: total ? watched / total : 0 };
}

/**
 * El mismo resumen sin cargar la franquicia: con sus títulos del manifiesto (ver catalog.ts)
 * y las continuidades ocultas del perfil. Lo usa el Hub.
 */
export function summarizeEntries(
  entries: readonly { titleId: string; season?: number; continuityId: string; releaseDate: string }[],
  hiddenContinuities: readonly string[],
  isWatched: IsWatched,
  today = todayIso(),
): ProgressSummary {
  let watched = 0;
  let total = 0;
  let upcoming = 0;
  for (const e of entries) {
    if (hiddenContinuities.includes(e.continuityId)) continue;
    if (e.releaseDate <= today) {
      total++;
      if (isWatched(e.titleId, e.season)) watched++;
    } else {
      upcoming++;
    }
  }
  return { watched, total, upcoming, ratio: total ? watched / total : 0 };
}

export function splitRuntime(min: number): { h: number; m: number } {
  return { h: Math.floor(min / 60), m: min % 60 };
}
