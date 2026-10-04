import { create } from "zustand";

// Progreso del perfil activo. La UI solo habla con este store; el backend decide dónde se
// guarda: localStorage en modo invitado o Firestore con sesión (SPEC §6). Mismas formas en ambos.

export type WatchStatus = "watched" | "watching" | "dropped" | "planned";

export const VIEWING_MEDIUMS = ["cinema", "streaming", "tv", "other"] as const;
export const VIEWING_FORMATS = ["2d", "3d", "4dx", "imax", "screenx", "dolby", "dubbed", "subbed"] as const;
export type ViewingMedium = (typeof VIEWING_MEDIUMS)[number];
export type ViewingFormat = (typeof VIEWING_FORMATS)[number];

/**
 * Una vez que se vio (cada replay es otra entrada). Todo opcional: lo escribe el perfil, no se
 * deduce. Qué opciones ofrece la UI depende del tipo de título (ver viewings.ts).
 */
export interface Viewing {
  /** Día (YYYY-MM-DD). */
  date?: string;
  place?: string;
  medium?: ViewingMedium;
  formats?: ViewingFormat[];
  /** Temporada que se vio (series). */
  season?: number;
  note?: string;
}

export interface ProgressDoc {
  status: WatchStatus;
  watchedAt?: string;
  rewatchCount: number;
  rating?: number;
  notes?: string;
  episodes?: Record<string, number[]>;
  versionId?: string;
  /** Cada vez que se vio, de la más antigua a la más reciente. */
  viewings?: Viewing[];
  /** @deprecated Una sola visualización (versión anterior): ver viewingsOf. */
  viewing?: Viewing;
  /** Cuándo se empezó a ver (estado "viendo"); se conserva al abandonar y retomar. */
  startedAt?: string;
  updatedAt: string;
}

export interface FranchiseStateDoc {
  lastOrderId?: string;
  customOrder?: string[];
  /** Ruta que el perfil abrió por última vez (`/f/…/r/…` o `/f/…/prep/…`): "continuar viendo" la sigue a ella. */
  activeRoute?: string;
  /** Nivel elegido en cada "Prepárate para…", por id del título objetivo. */
  prepLevels?: Record<string, string>;
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
  /**
   * Cambia campos de un título (calificación, notas, versión, episodios, rewatch). Si aún no
   * tiene progreso se crea con `status`; `status: null` en el parche lo borra.
   */
  updateProgress: (titleId: string, patch: Partial<Omit<ProgressDoc, "updatedAt" | "status">> & { status?: WatchStatus | null }) => void;
  /** Aplica varios cambios de una vez (visto hasta aquí, deshacer, importar). */
  applyMany: (changes: Record<string, ProgressDoc | null>) => void;
  setFranchiseState: (franchiseId: string, patch: Omit<Partial<FranchiseStateDoc>, "updatedAt">) => void;
  /** Escribe varios estados de franquicia tal cual (importar un respaldo). */
  applyFranchiseStates: (changes: Record<string, FranchiseStateDoc>) => void;
  /** Reemplaza todo el contenido (al cambiar de backend o al llegar un snapshot). */
  replace: (data: ProgressData) => void;
}

const now = () => new Date().toISOString();

/** Las visualizaciones de un título, también las guardadas con el formato anterior (una sola). */
export const viewingsOf = (doc: Pick<ProgressDoc, "viewings" | "viewing"> | undefined): Viewing[] =>
  doc?.viewings ?? (doc?.viewing ? [doc.viewing] : []);

/** Fechas que dependen del estado: se ve la primera vez que pasa a "viendo" / "visto". */
function stamps(prev: ProgressDoc | undefined, status: WatchStatus): Pick<ProgressDoc, "watchedAt" | "startedAt"> {
  return {
    watchedAt: status === "watched" ? (prev?.status === "watched" ? prev.watchedAt : now()) : prev?.watchedAt,
    startedAt: status === "watching" && !prev?.startedAt ? now() : prev?.startedAt,
  };
}

// ---- Backend de invitado: localStorage ----

export const GUEST_KEY = "watch-order:guest";
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
        ...stamps(prev, status),
        updatedAt: now(),
      };
      progress[titleId] = doc;
    }
    // Actualización optimista: el snapshot de Firestore confirma lo mismo al instante (caché local).
    set({ progress });
    backend.writeProgress(titleId, doc);
  },

  updateProgress: (titleId, patch) => {
    const prev = get().progress[titleId];
    const status = patch.status === undefined ? (prev?.status ?? "planned") : patch.status;
    if (status === null) return get().setStatus(titleId, null);
    const doc: ProgressDoc = {
      rewatchCount: 0,
      ...prev,
      ...patch,
      // El formato anterior (una sola visualización) se reemplaza por la lista.
      ...(patch.viewings ? { viewing: undefined } : {}),
      status,
      ...stamps(prev, status),
      updatedAt: now(),
    };
    set((s) => ({ progress: { ...s.progress, [titleId]: doc } }));
    backend.writeProgress(titleId, doc);
  },

  applyMany: (changes) => {
    const progress = { ...get().progress };
    for (const [id, doc] of Object.entries(changes)) {
      if (doc) progress[id] = doc;
      else delete progress[id];
    }
    set({ progress });
    for (const [id, doc] of Object.entries(changes)) backend.writeProgress(id, doc);
  },

  setFranchiseState: (franchiseId, patch) => {
    const doc: FranchiseStateDoc = { ...get().franchiseState[franchiseId], ...patch, updatedAt: now() };
    set((s) => ({ franchiseState: { ...s.franchiseState, [franchiseId]: doc } }));
    backend.writeFranchiseState(franchiseId, doc);
  },

  applyFranchiseStates: (changes) => {
    set((s) => ({ franchiseState: { ...s.franchiseState, ...changes } }));
    for (const [id, doc] of Object.entries(changes)) backend.writeFranchiseState(id, doc);
  },

  replace: (data) => set(pick(data)),
}));
