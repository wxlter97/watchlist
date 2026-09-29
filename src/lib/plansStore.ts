import { create } from "zustand";
import type { PlanDoc } from "./plans";

// Planes del perfil activo. Igual que el progreso: localStorage en invitado, Firestore con
// sesión (users/{uid}/profiles/{pid}/plans). session.ts cambia el backend y llena el store.

export interface PlansBackend {
  writePlan(planId: string, doc: PlanDoc | null): void;
}

const GUEST_KEY = "watch-order:guest-plans";

export function loadGuestPlans(): Record<string, PlanDoc> {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PlanDoc>) : {};
  } catch {
    return {};
  }
}

export function saveGuestPlans(plans: Record<string, PlanDoc>) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(plans));
  } catch {
    // Sin almacenamiento, los planes duran lo que dure la pestaña.
  }
}

export const guestPlansBackend: PlansBackend = {
  writePlan: () => saveGuestPlans(usePlansStore.getState().plans),
};

let backend: PlansBackend = guestPlansBackend;
export function setPlansBackend(next: PlansBackend) {
  backend = next;
}

interface PlansState {
  plans: Record<string, PlanDoc>;
  savePlan: (plan: Omit<PlanDoc, "updatedAt">) => void;
  deletePlan: (planId: string) => void;
  replacePlans: (plans: Record<string, PlanDoc>) => void;
}

export const usePlansStore = create<PlansState>()((set) => ({
  plans: loadGuestPlans(),
  savePlan: (plan) => {
    const doc: PlanDoc = { ...plan, updatedAt: new Date().toISOString() };
    set((s) => ({ plans: { ...s.plans, [doc.id]: doc } }));
    backend.writePlan(doc.id, doc);
  },
  deletePlan: (planId) => {
    set((s) => {
      const plans = { ...s.plans };
      delete plans[planId];
      return { plans };
    });
    backend.writePlan(planId, null);
  },
  replacePlans: (plans) => set({ plans }),
}));

/** Id corto y único para un plan nuevo (válido como id de documento de Firestore). */
export function newPlanId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}
