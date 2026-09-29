import type { ProgressDoc, WatchStatus } from "./progressStore";
import type { Title } from "./types";

// Episodios vistos por temporada: { "1": [1, 2, 3] } (SPEC §6, progress.episodes).

export type EpisodeMap = Record<string, number[]>;

export function totalEpisodes(title: Title): number {
  return title.seasons?.reduce((n, s) => n + s.episodes, 0) ?? 0;
}

export function watchedEpisodes(episodes: EpisodeMap | undefined): number {
  return Object.values(episodes ?? {}).reduce((n, list) => n + list.length, 0);
}

const clean = (map: EpisodeMap): EpisodeMap =>
  Object.fromEntries(
    Object.entries(map)
      .filter(([, list]) => list.length > 0)
      .map(([season, list]) => [season, [...new Set(list)].sort((a, b) => a - b)]),
  );

export function toggleEpisode(map: EpisodeMap | undefined, season: number, episode: number): EpisodeMap {
  const current = map?.[season] ?? [];
  const next = current.includes(episode) ? current.filter((e) => e !== episode) : [...current, episode];
  return clean({ ...map, [season]: next });
}

/** Marca o desmarca una temporada completa. */
export function setSeason(map: EpisodeMap | undefined, season: number, count: number, watched: boolean): EpisodeMap {
  return clean({ ...map, [season]: watched ? Array.from({ length: count }, (_, i) => i + 1) : [] });
}

/** Estado que corresponde a los episodios vistos: todo → visto; algo → viendo; nada → sin cambio. */
export function statusFromEpisodes(title: Title, map: EpisodeMap, current: WatchStatus | undefined): WatchStatus | undefined {
  const total = totalEpisodes(title);
  const seen = watchedEpisodes(map);
  if (total > 0 && seen >= total) return "watched";
  if (seen > 0) return current === "dropped" ? "dropped" : "watching";
  return current === "watched" || current === "watching" ? undefined : current;
}

/** Minutos vistos de un título según su estado, episodios y versión elegida. */
export function minutesWatched(title: Title, doc: ProgressDoc | undefined): number {
  if (!doc) return 0;
  const base =
    title.versions?.find((v) => v.id === doc.versionId)?.runtimeMin ??
    title.versions?.find((v) => v.default)?.runtimeMin ??
    title.runtimeMin ??
    0;
  if (doc.status === "watched") return base * (1 + (doc.rewatchCount ?? 0));
  const total = totalEpisodes(title);
  if (total > 0 && doc.episodes) return Math.round((base / total) * Math.min(watchedEpisodes(doc.episodes), total));
  return 0;
}
