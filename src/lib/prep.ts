import type { CatalogIndex } from "./catalogIndex";
import { effectiveHidden } from "./filters";
import { computeOrder, resolveOrder, type OrderedItem } from "./orders";
import { resolveRoute, type RouteItem } from "./routes";
import type { FranchiseStateDoc } from "./progressStore";
import type { Continuity, Franchise, Route, Title } from "./types";

// "Prepárate para…" en tres niveles, para cualquier título de una franquicia:
// - minimum: la ruta curada (kind "prep") si existe; si no, lo esencial que viene antes.
// - recommended: lo esencial y recomendado que viene antes, más lo curado.
// - all: todo lo que viene antes.
// "Antes" es el cronológico del linaje del título (ver before) y solo lo que se estrena antes
// que él. Lo curado que no está ahí (otra continuidad, como las X-Men de Fox para Doomsday)
// va primero, por estreno.

export type PrepLevel = "minimum" | "recommended" | "all";
export const PREP_LEVELS: readonly PrepLevel[] = ["minimum", "recommended", "all"];

export const isPrepLevel = (value: unknown): value is PrepLevel => PREP_LEVELS.includes(value as PrepLevel);

/** La ruta curada "Prepárate para" de ese título, si la franquicia tiene una. */
export function curatedPrep(franchise: Franchise, targetTitleId: string): Route | undefined {
  return franchise.routes.find((r) => r.kind === "prep" && r.targetTitleId === targetTitleId);
}

/**
 * Lo que viene antes del título en el cronológico, ya estrenado cuando él se estrena. Solo su
 * linaje: su continuidad, de las que se ramifica (hasta el título donde se separa) y las que
 * comparten línea de tiempo con ellas y se muestran por defecto. Otra línea temporal (T3 para
 * Destino oculto) no es un requisito.
 */
function before(franchise: Franchise, targetTitleId: string, index: CatalogIndex): OrderedItem[] {
  const target = index.titlesById.get(targetTitleId);
  const home = franchise.entries.find((e) => e.titleId === targetTitleId)?.continuityId;
  if (!target || !home) return [];
  const byId = new Map(franchise.continuities.map((c) => [c.id, c]));

  // Continuidad → título donde termina lo que cuenta de ella (undefined: hasta el objetivo).
  const lineage = new Map<string, string | undefined>();
  let current: string | undefined = home;
  let cutoff: string | undefined;
  while (current && !lineage.has(current)) {
    lineage.set(current, cutoff);
    const branch: Continuity["branchesFrom"] = byId.get(current)?.branchesFrom;
    cutoff = branch?.afterTitleId;
    current = branch?.continuityId;
  }
  const hiddenByDefault = new Set(effectiveHidden(franchise));
  for (const c of franchise.continuities) {
    const base = c.timelineOf && lineage.has(c.timelineOf) ? c.timelineOf : undefined;
    if (base && !lineage.has(c.id) && !hiddenByDefault.has(c.id)) lineage.set(c.id, lineage.get(base));
  }

  const chrono = franchise.orders.find((o) => o.type === "chronological")?.id;
  const items = computeOrder(franchise, resolveOrder(franchise, chrono), index.titlesById);
  const at = items.findIndex((i) => i.title.id === targetTitleId);
  if (at === -1) return [];
  // Posición del título de corte de cada continuidad ancestro.
  const cutoffAt = new Map([...lineage].flatMap(([c, t]) => (t ? [[c, items.findIndex((i) => i.title.id === t)] as const] : [])));
  return items.slice(0, at).filter((item, i) => {
    if (!lineage.has(item.entry.continuityId) || item.title.id === targetTitleId) return false;
    const limit = cutoffAt.get(item.entry.continuityId);
    return (limit === undefined || i <= limit) && item.releaseDate < target.releaseDate;
  });
}

const renumber = (items: RouteItem[]): RouteItem[] => items.map((item, i) => ({ ...item, position: i + 1 }));
const toRouteItem = ({ title, season, key, releaseDate, entry }: OrderedItem): RouteItem => ({ title, season, key, releaseDate, entry, position: 0 });

export function prepUnits(franchise: Franchise, targetTitleId: string, level: PrepLevel, index: CatalogIndex): RouteItem[] {
  const route = curatedPrep(franchise, targetTitleId);
  const curated = route ? resolveRoute(route, franchise, index) : [];
  const prior = before(franchise, targetTitleId, index);

  if (level === "minimum") {
    return renumber(route ? curated : prior.filter((i) => i.entry.importance === "essential").map(toRouteItem));
  }

  // Lo curado cuenta por temporada ("loki-2021#2") o por serie entera ("loki-2021").
  const curatedKeys = new Set(curated.map((i) => i.key));
  const isCurated = (i: OrderedItem) => curatedKeys.has(i.key) || curatedKeys.has(i.title.id);
  const chosen =
    level === "all" ? prior : prior.filter((i) => i.entry.importance === "essential" || i.entry.importance === "recommended" || isCurated(i));
  const priorTitles = new Set(prior.map((i) => i.title.id));
  const extras = curated.filter((i) => !priorTitles.has(i.title.id)).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return renumber([...extras, ...chosen.map(toRouteItem)]);
}

/** Con ruta curada se empieza por lo mínimo (la selección); sin ella, por lo recomendado. */
export const defaultPrepLevel = (curated: boolean): PrepLevel => (curated ? "minimum" : "recommended");

/** El nivel que el perfil eligió la última vez en ese "Prepárate para…" (o el de por defecto). */
export function prepLevelFor(state: Pick<FranchiseStateDoc, "prepLevels"> | undefined, targetTitleId: string, curated: boolean): PrepLevel {
  const saved = state?.prepLevels?.[targetTitleId];
  return isPrepLevel(saved) ? saved : defaultPrepLevel(curated);
}

/** `/f/{franquicia}/r/{ruta}` o `/f/{franquicia}/prep/{título}`. */
export function parseRoutePath(path: string): { franchiseId: string; kind: "r" | "prep"; ref: string } | undefined {
  const [, f, franchiseId, kind, ref] = path.split("/");
  return f === "f" && franchiseId && ref && (kind === "r" || kind === "prep") ? { franchiseId, kind, ref } : undefined;
}

export interface RouteUnits {
  route?: Route;
  /** Título al que prepara, si es un "Prepárate para…". */
  target?: Title;
  level?: PrepLevel;
  items: RouteItem[];
}

/**
 * Lo que muestra una ruta seguida o activa, con el nivel que el perfil eligió: una ruta
 * normal es su lista; un "Prepárate para…" (curado o automático), su lista según el nivel.
 */
export function routeUnits(path: string, franchise: Franchise, index: CatalogIndex, state: FranchiseStateDoc | undefined): RouteUnits | undefined {
  const parsed = parseRoutePath(path);
  if (!parsed || parsed.franchiseId !== franchise.id) return undefined;
  if (parsed.kind === "r") {
    const route = franchise.routes.find((r) => r.id === parsed.ref);
    if (!route) return undefined;
    const target = route.kind === "prep" && route.targetTitleId ? index.titlesById.get(route.targetTitleId) : undefined;
    if (!target) return { route, items: resolveRoute(route, franchise, index) };
    const level = prepLevelFor(state, target.id, true);
    return { route, target, level, items: prepUnits(franchise, target.id, level, index) };
  }
  const target = index.titlesById.get(parsed.ref);
  if (!target || !franchise.entries.some((e) => e.titleId === target.id)) return undefined;
  const route = curatedPrep(franchise, target.id);
  const level = prepLevelFor(state, target.id, Boolean(route));
  return { route, target, level, items: prepUnits(franchise, target.id, level, index) };
}
