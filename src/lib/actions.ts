import i18n from "./i18n";
import { externalUrl } from "./externalLinks";
import { seasonsPatch } from "./episodes";
import { useProgressStore, type ProgressDoc, type WatchStatus } from "./progressStore";
import { useSettings } from "./settings";
import { showToast } from "./toasts";
import type { Title } from "./types";

// Acciones de UI con efectos secundarios (avisos), usadas desde varias pantallas.

/** Cambia el estado; al marcar una película como vista ofrece registrarla en Letterboxd (SPEC §9.1). */
export function setTitleStatus(title: Title, status: WatchStatus | null) {
  const wasWatched = useProgressStore.getState().progress[title.id]?.status === "watched";
  useProgressStore.getState().setStatus(title.id, status);

  const { letterboxd, letterboxdToast } = useSettings.getState().externalLinks;
  const href = externalUrl("letterboxd", title);
  if (status === "watched" && !wasWatched && href && letterboxd && letterboxdToast) {
    showToast({
      message: i18n.t("toast.watched", { title: title.localized?.[i18n.resolvedLanguage === "en" ? "en" : "es"]?.title ?? title.title }),
      action: { label: i18n.t("toast.logLetterboxd"), href },
    });
  }
}

/** Marca o desmarca una unidad de un orden: el título entero o una temporada (ver units.ts). */
export function setUnitWatched(title: Title, season: number | undefined, watched: boolean) {
  if (season === undefined) return setTitleStatus(title, watched ? "watched" : null);
  const store = useProgressStore.getState();
  const patch = seasonsPatch(title, store.progress[title.id], [season], watched);
  if (!patch) return;
  if (patch.status === null) store.setStatus(title.id, null);
  else store.updateProgress(title.id, { episodes: patch.episodes, status: patch.status });
}

/**
 * Marca varias unidades como vistas de una vez ("Visto hasta aquí"). Devuelve el progreso
 * anterior de los títulos tocados, para deshacer con applyMany.
 */
export function markUnitsWatched(units: readonly { title: Title; season?: number }[]): Record<string, ProgressDoc | null> {
  const { progress, applyMany } = useProgressStore.getState();
  const byTitle = new Map<string, { title: Title; seasons: number[]; whole: boolean }>();
  for (const { title, season } of units) {
    const e = byTitle.get(title.id) ?? { title, seasons: [], whole: false };
    if (season === undefined) e.whole = true;
    else e.seasons.push(season);
    byTitle.set(title.id, e);
  }
  const now = new Date().toISOString();
  const before: Record<string, ProgressDoc | null> = {};
  const changes: Record<string, ProgressDoc> = {};
  for (const [id, { title, seasons, whole }] of byTitle) {
    const prev = progress[id];
    const patch = whole ? { status: "watched" as const } : seasonsPatch(title, prev, seasons, true);
    if (!patch || patch.status === null) continue;
    before[id] = prev ?? null;
    changes[id] = {
      rewatchCount: 0,
      ...prev,
      ...patch,
      status: patch.status,
      watchedAt: patch.status === "watched" ? (prev?.status === "watched" ? prev.watchedAt : now) : prev?.watchedAt,
      updatedAt: now,
    };
  }
  applyMany(changes);
  return before;
}
