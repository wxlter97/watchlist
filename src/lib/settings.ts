import { create } from "zustand";
import type { Lang } from "./types";

// Ajustes del usuario (SPEC §6, users/{uid}.settings). En invitado viven en localStorage;
// con sesión, session.ts cambia el escritor a Firestore (merge sobre settings).

export interface ExternalLinks {
  letterboxd: boolean;
  imdb: boolean;
  trakt: boolean;
  /** Aviso "Registrar en Letterboxd" al marcar una película como vista. */
  letterboxdToast: boolean;
}

/** Tipos de aviso push, cada uno se activa por separado (SPEC §9.6). */
export interface NotificationSettings {
  releases: boolean;
  streamingAvailable: boolean;
  catalogUpdates: boolean;
}

export const NO_NOTIFICATIONS: NotificationSettings = { releases: false, streamingAvailable: false, catalogUpdates: false };

export interface Settings {
  followedFranchises: string[];
  /** Rutas seguidas: su ruta en la app (`/f/marvel/r/…` o `/f/marvel/prep/{título}`). */
  followedRoutes: string[];
  spoilerFree: boolean;
  streamingRegion: string;
  language?: Lang;
  externalLinks: ExternalLinks;
  notifications: NotificationSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  followedFranchises: [],
  followedRoutes: [],
  spoilerFree: true,
  streamingRegion: "SV",
  externalLinks: { letterboxd: true, imdb: true, trakt: true, letterboxdToast: true },
  notifications: NO_NOTIFICATIONS,
};

/** Completa con valores por defecto lo que falte (documentos viejos o datos corruptos). */
export function withDefaults(raw: unknown): Settings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings>;
  return {
    followedFranchises: Array.isArray(s.followedFranchises) ? s.followedFranchises.filter((x) => typeof x === "string") : [],
    followedRoutes: Array.isArray(s.followedRoutes) ? s.followedRoutes.filter((x) => typeof x === "string") : [],
    spoilerFree: typeof s.spoilerFree === "boolean" ? s.spoilerFree : DEFAULT_SETTINGS.spoilerFree,
    streamingRegion: typeof s.streamingRegion === "string" && /^[A-Z]{2}$/.test(s.streamingRegion) ? s.streamingRegion : DEFAULT_SETTINGS.streamingRegion,
    language: s.language === "es" || s.language === "en" ? s.language : undefined,
    externalLinks: { ...DEFAULT_SETTINGS.externalLinks, ...(s.externalLinks ?? {}) },
    notifications: { ...NO_NOTIFICATIONS, ...(s.notifications ?? {}) },
  };
}

const GUEST_KEY = "watch-order:guest-settings";

export function loadGuestSettings(): Settings {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return withDefaults(raw ? JSON.parse(raw) : {});
  } catch {
    return withDefaults({});
  }
}

export type SettingsWriter = (patch: Partial<Settings>) => void;

export const guestSettingsWriter: SettingsWriter = (patch) => {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ ...loadGuestSettings(), ...patch }));
  } catch {
    // Sin almacenamiento, la elección dura la sesión.
  }
};

let writer: SettingsWriter = guestSettingsWriter;
export function setSettingsWriter(next: SettingsWriter) {
  writer = next;
}

export const useSettings = create<Settings>()(() => loadGuestSettings());

export function updateSettings(patch: Partial<Settings>) {
  useSettings.setState(patch);
  writer(patch);
}

export function toggleFollow(franchiseId: string) {
  const current = useSettings.getState().followedFranchises;
  updateSettings({
    followedFranchises: current.includes(franchiseId) ? current.filter((id) => id !== franchiseId) : [...current, franchiseId],
  });
}

export function toggleFollowRoute(path: string) {
  const current = useSettings.getState().followedRoutes;
  updateSettings({ followedRoutes: current.includes(path) ? current.filter((p) => p !== path) : [...current, path] });
}

export function setExternalLink(key: keyof ExternalLinks, value: boolean) {
  updateSettings({ externalLinks: { ...useSettings.getState().externalLinks, [key]: value } });
}

export function setNotification(key: keyof NotificationSettings, value: boolean) {
  updateSettings({ notifications: { ...useSettings.getState().notifications, [key]: value } });
}
