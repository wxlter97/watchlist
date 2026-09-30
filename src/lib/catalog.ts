import { useEffect, useMemo } from "react";
import { create } from "zustand";
import manifest from "virtual:catalog-manifest";
import { franchises as franchiseLoaders } from "virtual:catalog-loaders";
import { buildIndex, type CatalogIndex } from "./catalogIndex";
import type { Continuity, Franchise, LocalizedText, Title } from "./types";

// El catálogo se carga por partes (ver catalogData en vite.config.ts): al abrir la app solo
// llega el manifiesto; cada franquicia completa, con sus títulos, se descarga cuando una
// pantalla la pide. Así el arranque no crece con cada franquicia nueva del backlog.
//
// El índice (CatalogIndex) tiene lo cargado hasta el momento y se rehace al llegar cada
// franquicia. Las pantallas piden lo que necesitan con useCatalog y esperan a `ready`: con
// el índice incompleto, un cálculo (progreso, logros, estadísticas) daría otro resultado.

/** Lo que genera virtual:catalog-manifest. */
export interface ManifestData {
  franchises: {
    id: string;
    name: LocalizedText;
    description: LocalizedText;
    accentColor: string;
    continuities: Continuity[];
    /** [id del título, continuidad, fecha de estreno, temporada?, episodios de la temporada?] de cada entry. */
    titles: ([string, string, string] | [string, string, string, number, number])[];
    /** Títulos que no son entries pero aparecen en sus rutas u órdenes curados. */
    refs: string[];
  }[];
  /** Títulos por estrenarse o en emisión cuando se compiló la app. */
  spotlight: Title[];
}

/** Lo que genera virtual:catalog-franchise/{id}. */
export interface FranchiseChunk {
  franchise: Franchise;
  titles: Title[];
}

/** Una franquicia sin cargar: lo necesario para listarla y calcular su progreso. */
export interface FranchiseMeta {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  accentColor: string;
  continuities: Continuity[];
  titles: { titleId: string; continuityId: string; releaseDate: string; season?: number; seasonEpisodes?: number }[];
  refs: string[];
}

export const franchiseMetas: readonly FranchiseMeta[] = manifest.franchises.map((f) => ({
  ...f,
  titles: f.titles.map(([titleId, continuityId, releaseDate, season, seasonEpisodes]) =>
    season === undefined ? { titleId, continuityId, releaseDate } : { titleId, continuityId, releaseDate, season, seasonEpisodes },
  ),
}));
export const franchiseMetaById: ReadonlyMap<string, FranchiseMeta> = new Map(franchiseMetas.map((f) => [f.id, f]));
export const ALL_FRANCHISE_IDS: readonly string[] = franchiseMetas.map((f) => f.id);

/** Franquicias en las que cada título es entry, en el orden del catálogo. */
export const franchiseIdsByTitle: ReadonlyMap<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const f of franchiseMetas) for (const t of f.titles) map.set(t.titleId, [...(map.get(t.titleId) ?? []), f.id]);
  return map;
})();

/** Franquicias que mencionan cada título: como entry, en una ruta o en un orden curado. */
const franchiseIdsReferencing: ReadonlyMap<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const f of franchiseMetas)
    for (const id of [...f.titles.map((t) => t.titleId), ...f.refs]) map.set(id, [...(map.get(id) ?? []), f.id]);
  return map;
})();

/**
 * Todo lo que hay que cargar para mostrar un título completo: sus franquicias y las que lo
 * incluyen en una ruta ("aparece en", rutas, "Prepárate para").
 */
export const franchisesReferencing = (titleId: string | undefined): string[] =>
  (titleId && franchiseIdsReferencing.get(titleId)) || [];

/** Las franquicias a cargar para tener estos títulos (sin repetir). */
export function franchisesForTitles(titleIds: Iterable<string>): string[] {
  const ids = new Set<string>();
  for (const id of titleIds) {
    const f = franchiseIdsByTitle.get(id)?.[0] ?? franchiseIdsReferencing.get(id)?.[0];
    if (f) ids.add(f);
  }
  return [...ids];
}

// ---- Estado ----

interface CatalogState {
  index: CatalogIndex;
  /** Franquicias ya resueltas: cargadas, o inexistentes (no hay nada que esperar). */
  done: ReadonlySet<string>;
  failed: ReadonlySet<string>;
}

const titles = new Map<string, Title>(manifest.spotlight.map((t) => [t.id, t]));
const franchises = new Map<string, Franchise>();
const done = new Set<string>();
const failed = new Set<string>();
const pending = new Map<string, Promise<void>>();

const snapshot = (): CatalogState => ({
  // En el orden del catálogo, no en el de carga: "aparece en" no depende de qué llegó primero.
  index: buildIndex({
    titles: [...titles.values()],
    franchises: franchiseMetas.flatMap((m) => franchises.get(m.id) ?? []),
  }),
  done: new Set(done),
  failed: new Set(failed),
});

export const useCatalogStore = create<CatalogState>()(snapshot);

// Varias franquicias que llegan juntas rehacen el índice una sola vez.
let scheduled = false;
function commit() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    useCatalogStore.setState(snapshot());
  });
}

export function loadFranchise(id: string): Promise<void> {
  if (done.has(id)) return Promise.resolve();
  const running = pending.get(id);
  if (running) return running;
  const loader = franchiseLoaders[id];
  if (!loader) {
    done.add(id);
    commit();
    return Promise.resolve();
  }
  const promise = loader()
    .then(({ default: chunk }) => {
      if (chunk) {
        for (const t of chunk.titles) titles.set(t.id, t);
        franchises.set(id, chunk.franchise);
      }
      done.add(id);
      failed.delete(id);
    })
    .catch((err: unknown) => {
      // Sin conexión y sin caché: se reintenta la próxima vez que una pantalla la pida.
      console.error("[catalog]", id, err);
      failed.add(id);
    })
    .finally(() => {
      pending.delete(id);
      commit();
    });
  pending.set(id, promise);
  return promise;
}

export function loadFranchises(ids: Iterable<string>): Promise<void> {
  return Promise.all([...new Set(ids)].map(loadFranchise)).then(() => undefined);
}

export const loadAllFranchises = () => loadFranchises(ALL_FRANCHISE_IDS);

// ---- Hooks ----

export interface CatalogView {
  index: CatalogIndex;
  /** Todo lo pedido está cargado (o no existe). */
  ready: boolean;
  /** Alguna franquicia pedida no se pudo descargar. */
  failed: boolean;
}

/** Carga estas franquicias (o todas) y devuelve el índice. Esperar `ready` antes de calcular. */
export function useCatalog(franchiseIds: readonly (string | undefined)[] | "all"): CatalogView {
  const key = (franchiseIds === "all" ? ALL_FRANCHISE_IDS : franchiseIds.filter((id): id is string => Boolean(id))).join(",");
  const ids = useMemo(() => (key ? key.split(",") : []), [key]);
  const index = useCatalogStore((s) => s.index);
  const ready = useCatalogStore((s) => ids.every((id) => s.done.has(id)));
  const anyFailed = useCatalogStore((s) => ids.some((id) => s.failed.has(id)));
  useEffect(() => {
    void loadFranchises(ids);
  }, [ids]);
  return { index, ready, failed: anyFailed && !ready };
}

/** Como useCatalog, con las franquicias de estos títulos. */
export function useCatalogForTitles(titleIds: Iterable<string>): CatalogView {
  const key = franchisesForTitles(titleIds).join(",");
  return useCatalog(useMemo(() => (key ? key.split(",") : []), [key]));
}

/** El índice con lo cargado hasta ahora, sin pedir nada: para piezas dentro de una pantalla que ya cargó lo suyo. */
export const useCatalogIndex = () => useCatalogStore((s) => s.index);

/** La franquicia y las otras de las que toma títulos en sus rutas u órdenes curados. */
export function withReferences(franchiseId: string | undefined): string[] {
  if (!franchiseId) return [];
  const meta = franchiseMetaById.get(franchiseId);
  return [franchiseId, ...franchisesForTitles(meta?.refs ?? []).filter((id) => id !== franchiseId)];
}

/**
 * Todas las franquicias que mencionan alguno de estos títulos (como entry, en rutas u órdenes
 * curados). Con los títulos vistos, es lo que un logro o el resumen anual pueden necesitar:
 * una regla de una franquicia donde no se vio nada no se cumple aunque se cargue.
 */
export function franchisesMentioning(titleIds: Iterable<string>): string[] {
  const ids = new Set<string>();
  for (const id of titleIds) for (const f of franchiseIdsReferencing.get(id) ?? []) ids.add(f);
  return [...ids].sort();
}
