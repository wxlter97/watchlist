import type { Catalog, Entry, Franchise, Title } from "./types";

export interface CatalogIndex {
  titlesById: ReadonlyMap<string, Title>;
  franchisesById: ReadonlyMap<string, Franchise>;
  /** Franquicias en las que aparece cada título (un título puede estar en varias). */
  franchisesByTitle: ReadonlyMap<string, { franchise: Franchise; entry: Entry }[]>;
}

export function buildIndex(catalog: Catalog): CatalogIndex {
  const franchisesByTitle = new Map<string, { franchise: Franchise; entry: Entry }[]>();
  for (const franchise of catalog.franchises) {
    for (const entry of franchise.entries) {
      const list = franchisesByTitle.get(entry.titleId) ?? [];
      list.push({ franchise, entry });
      franchisesByTitle.set(entry.titleId, list);
    }
  }
  return {
    titlesById: new Map(catalog.titles.map((t) => [t.id, t])),
    franchisesById: new Map(catalog.franchises.map((f) => [f.id, f])),
    franchisesByTitle,
  };
}
