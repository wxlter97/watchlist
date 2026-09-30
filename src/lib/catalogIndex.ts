import type { Catalog, Entry, Franchise, Route, Title } from "./types";
import { parseUnitKey } from "./units";

export interface RouteRef {
  franchise: Franchise;
  route: Route;
}

export interface CatalogIndex {
  titlesById: ReadonlyMap<string, Title>;
  franchisesById: ReadonlyMap<string, Franchise>;
  /** Franquicias en las que aparece cada título (un título puede estar en varias). */
  franchisesByTitle: ReadonlyMap<string, { franchise: Franchise; entry: Entry }[]>;
  /** Rutas que incluyen cada título. */
  routesByTitle: ReadonlyMap<string, RouteRef[]>;
  /** Rutas "Prepárate para…" cuyo objetivo es cada título. */
  prepByTarget: ReadonlyMap<string, RouteRef[]>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildIndex(catalog: Catalog): CatalogIndex {
  const franchisesByTitle = new Map<string, { franchise: Franchise; entry: Entry }[]>();
  const routesByTitle = new Map<string, RouteRef[]>();
  const prepByTarget = new Map<string, RouteRef[]>();

  for (const franchise of catalog.franchises) {
    for (const entry of franchise.entries) push(franchisesByTitle, entry.titleId, { franchise, entry });
    for (const route of franchise.routes) {
      for (const id of new Set(route.titleIds.map((k) => parseUnitKey(k).titleId))) push(routesByTitle, id, { franchise, route });
      if (route.kind === "prep" && route.targetTitleId) push(prepByTarget, route.targetTitleId, { franchise, route });
    }
  }

  return {
    titlesById: new Map(catalog.titles.map((t) => [t.id, t])),
    franchisesById: new Map(catalog.franchises.map((f) => [f.id, f])),
    franchisesByTitle,
    routesByTitle,
    prepByTarget,
  };
}
