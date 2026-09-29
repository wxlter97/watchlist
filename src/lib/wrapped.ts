import type { UnlockDoc } from "./achievementsStore";
import type { CatalogIndex } from "./catalogIndex";
import { minutesWatched, watchedEpisodes } from "./episodes";
import type { ProgressDoc } from "./progressStore";
import { computeStreak, localDay } from "./streaks";
import type { Franchise, Title } from "./types";

// Resumen anual (SPEC §9.4): lo visto en un año calendario, en hora local. Un título cuenta
// en el año en que se terminó; lo que sigue en curso, en el año de su último episodio.
// Los rewatches no tienen fecha propia: cada título suma su duración una vez.

export interface Wrapped {
  year: number;
  minutes: number;
  titles: Title[];
  episodes: number;
  /** Franquicia con más minutos en el año. */
  topFranchise?: { franchise: Franchise; minutes: number };
  /** Mejor calificado del año; con empate, el más reciente. */
  topTitle?: { title: Title; rating: number };
  /** Títulos o episodios marcados por mes (0 = enero). */
  months: number[];
  /** 1-12, el mes con más actividad. */
  topMonth?: number;
  achievements: string[];
  bestStreak: number;
}

const yearOf = (iso: string) => Number(localDay(iso).slice(0, 4));
const monthOf = (iso: string) => Number(localDay(iso).slice(5, 7)) - 1;

export function computeWrapped(
  index: CatalogIndex,
  progress: Readonly<Record<string, ProgressDoc>>,
  unlocked: Readonly<Record<string, UnlockDoc>>,
  year: number,
): Wrapped {
  const titles: Title[] = [];
  const months = Array.from({ length: 12 }, () => 0);
  const days = new Set<string>();
  const perFranchise = new Map<string, number>();
  let minutes = 0;
  let episodes = 0;
  let topTitle: Wrapped["topTitle"];
  let topTitleAt = "";

  for (const [id, doc] of Object.entries(progress)) {
    const title = index.titlesById.get(id);
    if (!title) continue;
    const finished = doc.status === "watched" && doc.watchedAt && yearOf(doc.watchedAt) === year;
    const inProgress = !finished && doc.status !== "watched" && doc.episodes && yearOf(doc.updatedAt) === year;
    if (!finished && !inProgress) continue;

    const at = finished ? doc.watchedAt! : doc.updatedAt;
    const m = minutesWatched(title, { ...doc, rewatchCount: 0 });
    minutes += m;
    episodes += watchedEpisodes(doc.episodes);
    months[monthOf(at)]!++;
    days.add(localDay(at));
    for (const { franchise } of index.franchisesByTitle.get(id) ?? []) {
      perFranchise.set(franchise.id, (perFranchise.get(franchise.id) ?? 0) + m);
    }
    if (finished) {
      titles.push(title);
      if (doc.rating && (!topTitle || doc.rating > topTitle.rating || (doc.rating === topTitle.rating && at > topTitleAt))) {
        topTitle = { title, rating: doc.rating };
        topTitleAt = at;
      }
    }
  }

  const [bestFranchise] = [...perFranchise.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const topMonthIndex = months.reduce((best, n, i) => (n > months[best]! ? i : best), 0);

  return {
    year,
    minutes,
    titles: titles.sort((a, b) => (progress[a.id]!.watchedAt! < progress[b.id]!.watchedAt! ? -1 : 1)),
    episodes,
    topFranchise:
      bestFranchise && bestFranchise[1] > 0
        ? { franchise: index.franchisesById.get(bestFranchise[0])!, minutes: bestFranchise[1] }
        : undefined,
    topTitle,
    months,
    topMonth: months[topMonthIndex]! > 0 ? topMonthIndex + 1 : undefined,
    achievements: Object.entries(unlocked)
      .filter(([, u]) => yearOf(u.unlockedAt) === year)
      .sort((a, b) => a[1].unlockedAt.localeCompare(b[1].unlockedAt))
      .map(([id]) => id),
    bestStreak: computeStreak(days, `${year}-12-31`).best,
  };
}

/** El resumen se ofrece en diciembre; el resto del año, bajo demanda. */
export const isWrappedSeason = (today: string) => today.slice(5, 7) === "12";
