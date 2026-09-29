import type { Entry, Franchise, OrderDef, Title } from "./types";

/** Orden personalizado por perfil (no se declara en el JSON; existe en todas las franquicias). */
export const CUSTOM_ORDER_ID = "custom";

export type ResolvedOrder = OrderDef | { id: typeof CUSTOM_ORDER_ID; type: "custom"; titleIds: string[] };

export interface OrderedItem {
  entry: Entry;
  title: Title;
  /** Posición 1-based en el orden completo, antes de aplicar filtros: no cambia al filtrar. */
  position: number;
  /** Sección a la que pertenece en un orden agrupado. */
  section?: string;
}

export interface OrderOptions {
  hiddenContinuities?: readonly string[];
}

type Pair = { entry: Entry; title: Title };

const byRelease = (a: Pair, b: Pair) =>
  a.title.releaseDate.localeCompare(b.title.releaseDate) || a.title.id.localeCompare(b.title.id);

export function computeOrder(
  franchise: Franchise,
  order: ResolvedOrder,
  titlesById: ReadonlyMap<string, Title>,
  options: OrderOptions = {},
): OrderedItem[] {
  const pairs: Pair[] = [];
  for (const entry of franchise.entries) {
    const title = titlesById.get(entry.titleId);
    if (title) pairs.push({ entry, title });
  }

  let sorted: (Pair & { section?: string })[];
  switch (order.type) {
    case "release":
      sorted = [...pairs].sort(byRelease);
      break;

    case "chronological": {
      const continuityRank = new Map(franchise.continuities.map((c, i) => [c.id, i]));
      const rank = (p: Pair) => continuityRank.get(p.entry.continuityId) ?? Number.MAX_SAFE_INTEGER;
      sorted = [...pairs].sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a.entry.chronoOrder ?? Infinity) - (b.entry.chronoOrder ?? Infinity) ||
          byRelease(a, b),
      );
      break;
    }

    case "grouped": {
      const groups = Object.keys(order.groupLabels);
      const groupRank = (p: Pair) => {
        const i = p.entry.group ? groups.indexOf(p.entry.group) : -1;
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
      };
      sorted = [...pairs]
        .sort((a, b) => groupRank(a) - groupRank(b) || byRelease(a, b))
        .map((p) => ({ ...p, section: p.entry.group && order.groupLabels[p.entry.group] ? p.entry.group : undefined }));
      break;
    }

    case "curated":
    case "custom": {
      const byId = new Map(pairs.map((p) => [p.title.id, p]));
      const listed = order.titleIds.flatMap((id) => byId.get(id) ?? []);
      if (order.type === "curated") {
        sorted = listed;
      } else {
        // Títulos agregados al catálogo después de guardar el orden van al final.
        const seen = new Set(listed.map((p) => p.title.id));
        sorted = [...listed, ...pairs.filter((p) => !seen.has(p.title.id)).sort(byRelease)];
      }
      break;
    }
  }

  const hidden = new Set(options.hiddenContinuities ?? []);
  return sorted
    .map((p, i) => ({ ...p, position: i + 1 }))
    .filter((item) => !hidden.has(item.entry.continuityId));
}

/** Primer título del orden que aún no se ha visto. */
export function nextUp(items: readonly OrderedItem[], isWatched: (titleId: string) => boolean): OrderedItem | undefined {
  return items.find((item) => !isWatched(item.title.id));
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
