import { create } from "zustand";

// Ajustes del usuario que la UI usa hoy: franquicias seguidas (SPEC §6, users/{uid}.settings).
// En invitado viven en localStorage; con sesión, session.ts cambia el escritor a Firestore.

interface SettingsState {
  followedFranchises: string[];
}

const GUEST_KEY = "watch-order:guest-settings";

export function loadGuestSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SettingsState>) : {};
    return { followedFranchises: Array.isArray(parsed.followedFranchises) ? parsed.followedFranchises : [] };
  } catch {
    return { followedFranchises: [] };
  }
}

export type SettingsWriter = (patch: Partial<SettingsState>) => void;

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

export const useSettings = create<SettingsState>()(() => loadGuestSettings());

export function toggleFollow(franchiseId: string) {
  const current = useSettings.getState().followedFranchises;
  const followedFranchises = current.includes(franchiseId)
    ? current.filter((id) => id !== franchiseId)
    : [...current, franchiseId];
  useSettings.setState({ followedFranchises });
  writer({ followedFranchises });
}
