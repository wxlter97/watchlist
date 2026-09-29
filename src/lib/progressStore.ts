import { useCallback } from "react";
import { create } from "zustand";

// Progreso del perfil activo. La UI solo habla con este store; el backend decide dónde se
// guarda: localStorage en modo invitado o Firestore con sesión (SPEC §6). Mismas formas en ambos.

export type WatchStatus = "watched" | "watching" | "dropped" | "planned";

export interface ProgressDoc {
  status: WatchStatus;
  watchedAt?: string;
  rewatchCount: number;
  rating?: number;
  notes?: string;
  episodes?: Record<string, number[]>;
  versionId?: string;
  updatedAt: string;
}

export interface FranchiseStateDoc {
  lastOrderId?: string;
  customOrder?: string[];
  /** Excepciones al hiddenByDefault del catálogo: visibles por defecto que el perfil ocultó… */
  hiddenContinuities?: string[];
  /** …y ocultas por defecto que activó. */
  shownContinuities?: string[];
  updatedAt: string;
}

export interface ProgressData {
  /** Progreso por título, no por franquicia: verlo una vez cuenta en todas. */
  progress: Record<string, ProgressDoc>;
  franchiseState: Record<string, FranchiseStateDoc>;
}

export interface ProgressBackend {
  writeProgress(titleId: string, doc: ProgressDoc | null): void;
  writeFranchiseState(franchiseId: string, doc: FranchiseStateDoc): void;
}

interface ProgressState extends ProgressData {
  setStatus: (titleId: string, status: WatchStatus | null) => void;
  setFranchiseState: (franchiseId: string, patch: Omit<Partial<FranchiseStateDoc>, "updatedAt">) => void;
  /** Reemplaza todo el contenido (al cambiar de backend o al llegar un snapshot). */
  replace: (data: ProgressData) => void;
}

const now = () => new Date().toISOString();

// ---- Backend de invitado: localStorage ----

const GUEST_KEY = "watch-order:guest";
export const EMPTY: ProgressData = { progress: {}, franchiseState: {} };

export function loadGuest(): ProgressData {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const state = raw ? (JSON.parse(raw) as { state?: Partial<ProgressData> }).state : undefined;
    return { progress: state?.progress ?? {}, franchiseState: state?.franchiseState ?? {} };
  } catch {
    return { progress: {}, franchiseState: {} };
  }
}

export function saveGuest(data: ProgressData) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ state: data, version: 1 }));
  } catch {
    // Almacenamiento lleno o bloqueado: el progreso dura lo que dure la pestaña.
  }
}

export function hasGuestData(data = loadGuest()): boolean {
  return Object.keys(data.progress).length > 0 || Object.keys(data.franchiseState).length > 0;
}

export const guestBackend: ProgressBackend = {
  writeProgress: () => saveGuest(pick(useProgressStore.getState())),
  writeFranchiseState: () => saveGuest(pick(useProgressStore.getState())),
};

let backend: ProgressBackend = guestBackend;

export function setBackend(next: ProgressBackend) {
  backend = next;
}

const pick = ({ progress, franchiseState }: ProgressData): ProgressData => ({ progress, franchiseState });

// ---- Store ----

export const useProgressStore = create<ProgressState>()((set, get) => ({
  ...loadGuest(),

  setStatus: (titleId, status) => {
    const progress = { ...get().progress };
    let doc: ProgressDoc | null = null;
    if (status === null) {
      delete progress[titleId];
    } else {
      const prev = progress[titleId];
      doc = {
        rewatchCount: 0,
        ...prev,
        status,
        watchedAt: status === "watched" ? (prev?.status === "watched" ? prev.watchedAt : now()) : prev?.watchedAt,
        updatedAt: now(),
      };
      progress[titleId] = doc;
    }
    // Actualización optimista: el snapshot de Firestore confirma lo mismo al instante (caché local).
    set({ progress });
    backend.writeProgress(titleId, doc);
  },

  setFranchiseState: (franchiseId, patch) => {
    const doc: FranchiseStateDoc = { ...get().franchiseState[franchiseId], ...patch, updatedAt: now() };
    set((s) => ({ franchiseState: { ...s.franchiseState, [franchiseId]: doc } }));
    backend.writeFranchiseState(franchiseId, doc);
  },

  replace: (data) => set(pick(data)),
}));

export function useIsWatched() {
  const progress = useProgressStore((s) => s.progress);
  return useCallback((titleId: string) => progress[titleId]?.status === "watched", [progress]);
}
