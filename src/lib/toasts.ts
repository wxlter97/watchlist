import { create } from "zustand";

// Avisos breves con una acción opcional (deshacer, abrir en Letterboxd…).

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; onClick?: () => void; href?: string };
  /** ms hasta cerrarse solo. */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let nextId = 1;

export function showToast(toast: Omit<Toast, "id" | "duration"> & { duration?: number }) {
  const id = nextId++;
  const full: Toast = { duration: 6000, ...toast, id };
  // Máximo dos a la vez: el más viejo se va.
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-1), full] }));
  setTimeout(() => useToasts.getState().dismiss(id), full.duration);
  return id;
}
