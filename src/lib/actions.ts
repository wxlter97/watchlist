import i18n from "./i18n";
import { externalUrl } from "./externalLinks";
import { useProgressStore, type WatchStatus } from "./progressStore";
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
