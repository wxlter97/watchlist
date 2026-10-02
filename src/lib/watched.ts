import { useMemo } from "react";
import { franchiseMetas, useCatalogIndex } from "./catalog";
import { useProgressStore } from "./progressStore";
import { isUnitWatched, unitKey, watchedPredicate, type IsWatched } from "./units";

/**
 * ¿Visto? por título y, opcionalmente, temporada, con el progreso del perfil activo. Las
 * temporadas necesitan el título cargado (para saber cuántos episodios tiene cada una).
 */
export function useIsWatched(): IsWatched {
  const progress = useProgressStore((s) => s.progress);
  const index = useCatalogIndex();
  return useMemo(() => watchedPredicate(progress, index.titlesById), [progress, index]);
}

/** Episodios de cada temporada repartida, según el manifiesto ("loki-2021#2" → 6). */
const manifestSeasonEpisodes = new Map(
  franchiseMetas.flatMap((f) => f.titles.flatMap((t) => (t.season === undefined ? [] : [[unitKey(t.titleId, t.season), t.seasonEpisodes ?? 0] as const]))),
);

/** Como useIsWatched, sin cargar franquicias: para el Hub, que trabaja con el manifiesto. */
export function useManifestIsWatched(): IsWatched {
  const progress = useProgressStore((s) => s.progress);
  return useMemo(
    () => (titleId: string, season?: number) =>
      isUnitWatched(progress[titleId], season, season === undefined ? undefined : manifestSeasonEpisodes.get(unitKey(titleId, season))),
    [progress],
  );
}

/** ¿Abandonado? Lo abandonado no cuenta como "siguiente" en ninguna lista. */
export function useIsDropped(): (titleId: string) => boolean {
  const progress = useProgressStore((s) => s.progress);
  return useMemo(() => (titleId: string) => progress[titleId]?.status === "dropped", [progress]);
}
