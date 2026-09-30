import type { Entry, Franchise, OrderDef, Title } from "./types";
import { parseUnitKey, unitKey, unitReleaseDate, type IsWatched } from "./units";

/** Orden personalizado por perfil (no se declara en el JSON; existe en todas las franquicias). */
export const CUSTOM_ORDER_ID = "custom";

export type ResolvedOrder = OrderDef | { id: typeof CUSTOM_ORDER_ID; type: "custom"; titleIds: string[] };

export interface OrderedItem {
  entry: Entry;
  title: Title;
  /** La temporada, si la entry es de una sola (ver units.ts). */
  season?: number;
  /** Id de la unidad: el del título o "título#temporada". */
  key: string;
  /** Estreno de la unidad (el de la temporada, si es una). */
  releaseDate: string;
  /** Posición 1-based en el orden completo, antes de aplicar filtros: no cambia al filtrar. */
  position: number;
  /** Sección a la que pertenece en un orden agrupado. */
  section?: string;
}

export interface OrderOptions {
  hiddenContinuities?: readonly string[];
}

type Unit = Omit<OrderedItem, "position" | "section">;

const byRelease = (a: Unit, b: Unit) =>
  a.releaseDate.localeCompare(b.releaseDate) || a.title.id.localeCompare(b.title.id) || (a.season ?? 0) - (b.season ?? 0);

/** Las unidades de la franquicia: una por entry (título completo o temporada). */
function unitsOf(franchise: Franchise, titlesById: ReadonlyMap<string, Title>): Unit[] {
  return franchise.entries.flatMap((entry) => {
    const title = titlesById.get(entry.titleId);
    if (!title) return [];
    return [{ entry, title, season: entry.season, key: unitKey(title.id, entry.season), releaseDate: unitReleaseDate(title, entry.season) }];
  });
}

/**
 * Las unidades que nombra una lista de ids (órdenes curados, personalizados, rutas). Un id de
 * título repartido por temporadas trae todas sus temporadas, en orden.
 */
export function expandKeys<U extends { key: string; title: Title; season?: number }>(keys: readonly string[], units: readonly U[]): U[] {
  const byKey = new Map(units.map((u) => [u.key, u]));
  const seen = new Set<string>();
  const out: U[] = [];
  for (const key of keys) {
    const exact = byKey.get(key);
    const { titleId, season } = parseUnitKey(key);
    const matches = exact
      ? [exact]
      : season === undefined
        ? units.filter((u) => u.title.id === titleId).sort((a, b) => (a.season ?? 0) - (b.season ?? 0))
        : [];
    for (const u of matches) {
      if (seen.has(u.key)) continue;
      seen.add(u.key);
      out.push(u);
    }
  }
  return out;
}

export function computeOrder(
  franchise: Franchise,
  order: ResolvedOrder,
  titlesById: ReadonlyMap<string, Title>,
  options: OrderOptions = {},
): OrderedItem[] {
  const units = unitsOf(franchise, titlesById);

  let sorted: (Unit & { section?: string })[];
  switch (order.type) {
    case "release":
      sorted = [...units].sort(byRelease);
      break;

    case "chronological": {
      // Las continuidades que comparten línea de tiempo (timelineOf) se intercalan con la suya.
      const continuityRank = new Map(franchise.continuities.map((c, i) => [c.id, i]));
      const timelineRank = new Map(
        franchise.continuities.map((c) => [c.id, continuityRank.get(c.timelineOf ?? c.id) ?? Number.MAX_SAFE_INTEGER]),
      );
      const rank = (u: Unit) => timelineRank.get(u.entry.continuityId) ?? Number.MAX_SAFE_INTEGER;
      sorted = [...units].sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a.entry.chronoOrder ?? Infinity) - (b.entry.chronoOrder ?? Infinity) ||
          byRelease(a, b),
      );
      break;
    }

    case "grouped": {
      const groups = Object.keys(order.groupLabels);
      const groupRank = (u: Unit) => {
        const i = u.entry.group ? groups.indexOf(u.entry.group) : -1;
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
      };
      sorted = [...units]
        .sort((a, b) => groupRank(a) - groupRank(b) || byRelease(a, b))
        .map((u) => ({ ...u, section: u.entry.group && order.groupLabels[u.entry.group] ? u.entry.group : undefined }));
      break;
    }

    case "curated":
    case "custom": {
      const listed = expandKeys(order.titleIds, units);
      if (order.type === "curated") {
        sorted = listed;
      } else {
        // Títulos agregados al catálogo después de guardar el orden van al final.
        const seen = new Set(listed.map((u) => u.key));
        sorted = [...listed, ...units.filter((u) => !seen.has(u.key)).sort(byRelease)];
      }
      break;
    }
  }

  const hidden = new Set(options.hiddenContinuities ?? []);
  return sorted
    .map((u, i) => ({ ...u, position: i + 1 }))
    .filter((item) => !hidden.has(item.entry.continuityId));
}

/** Primer título (o temporada) del orden que aún no se ha visto. */
export function nextUp(items: readonly OrderedItem[], isWatched: IsWatched): OrderedItem | undefined {
  return items.find((item) => !isWatched(item.title.id, item.season));
}

export function resolveOrder(
  franchise: Franchise,
  orderId: string | undefined,
  customOrder?: readonly string[],
): ResolvedOrder {
  if (orderId === CUSTOM_ORDER_ID) return { id: CUSTOM_ORDER_ID, type: "custom", titleIds: [...(customOrder ?? [])] };
  return (
    franchise.orders.find((o) => o.id === orderId) ??
    franchise.orders.find((o) => o.type === "release") ??
    franchise.orders[0]!
  );
}

/**
 * "Visto hasta aquí" (SPEC §9.2): las unidades ya estrenadas del orden activo hasta `key`
 * inclusive que todavía no están vistas.
 */
export function watchedUpTo(items: readonly OrderedItem[], key: string, isWatched: IsWatched, today: string): OrderedItem[] {
  const end = items.findIndex((i) => i.key === key);
  if (end === -1) return [];
  return items.slice(0, end + 1).filter((i) => i.releaseDate <= today && !isWatched(i.title.id, i.season));
}
