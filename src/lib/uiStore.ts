import { create } from "zustand";
import { NO_FILTERS, type Filters } from "./filters";

// Estado de UI que no es progreso: se pierde al cerrar la pestaña, a propósito.

interface UiState {
  filters: Record<string, Filters>;
  setFilters: (franchiseId: string, patch: Partial<Filters>) => void;
  clearFilters: (franchiseId: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  filters: {},
  setFilters: (franchiseId, patch) =>
    set((s) => ({ filters: { ...s.filters, [franchiseId]: { ...(s.filters[franchiseId] ?? NO_FILTERS), ...patch } } })),
  clearFilters: (franchiseId) => set((s) => ({ filters: { ...s.filters, [franchiseId]: NO_FILTERS } })),
}));
