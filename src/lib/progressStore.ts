import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Progreso local (modo invitado). Mismas formas que users/{uid}/profiles/{profileId}/…
// en Firestore (SPEC §6), para que la fase de sync solo cambie dónde se guardan.

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
  hiddenContinuities?: string[];
  updatedAt: string;
}

interface ProgressState {
  /** Progreso por título, no por franquicia: verlo una vez cuenta en todas. */
  progress: Record<string, ProgressDoc>;
  franchiseState: Record<string, FranchiseStateDoc>;
  setStatus: (titleId: string, status: WatchStatus | null) => void;
  setFranchiseState: (franchiseId: string, patch: Omit<Partial<FranchiseStateDoc>, "updatedAt">) => void;
}

const now = () => new Date().toISOString();

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      progress: {},
      franchiseState: {},
      setStatus: (titleId, status) =>
        set((s) => {
          const progress = { ...s.progress };
          if (status === null) {
            delete progress[titleId];
          } else {
            const prev = progress[titleId];
            progress[titleId] = {
              rewatchCount: 0,
              ...prev,
              status,
              watchedAt: status === "watched" ? (prev?.status === "watched" ? prev.watchedAt : now()) : prev?.watchedAt,
              updatedAt: now(),
            };
          }
          return { progress };
        }),
      setFranchiseState: (franchiseId, patch) =>
        set((s) => ({
          franchiseState: { ...s.franchiseState, [franchiseId]: { ...s.franchiseState[franchiseId], ...patch, updatedAt: now() } },
        })),
    }),
    {
      name: "watch-order:guest",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ progress, franchiseState }) => ({ progress, franchiseState }),
    },
  ),
);

export function useIsWatched() {
  const progress = useProgressStore((s) => s.progress);
  return (titleId: string) => progress[titleId]?.status === "watched";
}
