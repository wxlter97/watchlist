import type { CatalogIndex } from "./catalogIndex";
import { minutesWatched, watchedEpisodes } from "./episodes";
import type { ProgressDoc } from "./progressStore";
import { activityDays, computeStreak, type Streak } from "./streaks";
import type { Franchise } from "./types";

// Estadísticas (SPEC §8.6). Un título cuenta una vez aunque esté en varias franquicias.

export interface FranchiseStats {
  franchise: Franchise;
  minutes: number;
  watched: number;
  /** Títulos estrenados de las continuidades visibles por defecto. */
  total: number;
}

export interface Stats {
  minutes: number;
  titlesWatched: number;
  episodesWatched: number;
  averageRating: number | null;
  ratedCount: number;
  perFranchise: FranchiseStats[];
  topFranchise: FranchiseStats | null;
  streak: Streak;
}

export function computeStats(index: CatalogIndex, progress: Record<string, ProgressDoc>, today: string): Stats {
  let minutes = 0;
  let titlesWatched = 0;
  let episodesWatched = 0;
  const ratings: number[] = [];
  for (const [id, doc] of Object.entries(progress)) {
    const title = index.titlesById.get(id);
    if (!title) continue;
    minutes += minutesWatched(title, doc);
    if (doc.status === "watched") titlesWatched++;
    episodesWatched += watchedEpisodes(doc.episodes);
    if (doc.rating) ratings.push(doc.rating);
  }

  const perFranchise = [...index.franchisesById.values()]
    .map((franchise) => {
      const visible = new Set(franchise.continuities.filter((c) => !c.hiddenByDefault).map((c) => c.id));
      let fMinutes = 0;
      let watched = 0;
      let total = 0;
      for (const entry of franchise.entries) {
        const title = index.titlesById.get(entry.titleId);
        if (!title) continue;
        const doc = progress[title.id];
        fMinutes += minutesWatched(title, doc);
        if (!visible.has(entry.continuityId) || title.releaseDate > today) continue;
        total++;
        if (doc?.status === "watched") watched++;
      }
      return { franchise, minutes: fMinutes, watched, total };
    })
    .sort((a, b) => b.minutes - a.minutes || b.watched - a.watched);

  return {
    minutes,
    titlesWatched,
    episodesWatched,
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    ratedCount: ratings.length,
    perFranchise,
    topFranchise: perFranchise[0] && perFranchise[0].minutes > 0 ? perFranchise[0] : null,
    streak: computeStreak(activityDays(progress), today),
  };
}
