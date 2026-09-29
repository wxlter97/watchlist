import { create } from "zustand";

// Logros desbloqueados del perfil activo (SPEC §6: achievements/{id} con unlockedAt). Se
// calculan en el cliente; aquí solo vive la fecha. Invitado: localStorage. Sesión: Firestore.

export interface UnlockDoc {
  unlockedAt: string;
}

export interface AchievementsBackend {
  writeUnlocks(unlocks: Record<string, UnlockDoc>): void;
}

const GUEST_KEY = "watch-order:guest-achievements";

export function loadGuestAchievements(): Record<string, UnlockDoc> {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, UnlockDoc>) : {};
  } catch {
    return {};
  }
}

export function saveGuestAchievements(unlocked: Record<string, UnlockDoc>) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(unlocked));
  } catch {
    // Sin almacenamiento, se vuelven a desbloquear en la próxima visita.
  }
}

export const guestAchievementsBackend: AchievementsBackend = {
  writeUnlocks: () => saveGuestAchievements(useAchievementsStore.getState().unlocked),
};

let backend: AchievementsBackend = guestAchievementsBackend;
export function setAchievementsBackend(next: AchievementsBackend) {
  backend = next;
}

interface AchievementsState {
  unlocked: Record<string, UnlockDoc>;
  /** Ya llegó lo guardado: antes de eso no se evalúa (evita desbloquear dos veces). */
  loaded: boolean;
  unlock: (ids: string[], at?: string) => void;
  replaceUnlocked: (unlocked: Record<string, UnlockDoc>, loaded?: boolean) => void;
}

export const useAchievementsStore = create<AchievementsState>()((set, get) => ({
  unlocked: loadGuestAchievements(),
  loaded: true,
  unlock: (ids, at = new Date().toISOString()) => {
    const fresh = Object.fromEntries(ids.filter((id) => !(id in get().unlocked)).map((id) => [id, { unlockedAt: at }]));
    if (!Object.keys(fresh).length) return;
    set((s) => ({ unlocked: { ...s.unlocked, ...fresh } }));
    backend.writeUnlocks(fresh);
  },
  replaceUnlocked: (unlocked, loaded = true) => set({ unlocked, loaded }),
}));
