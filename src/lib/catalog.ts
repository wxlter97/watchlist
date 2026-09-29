import titlesJson from "../data/titles.json";
import type { Catalog, Franchise, Title } from "./types";
import { buildIndex } from "./catalogIndex";

// Cada archivo en data/franchises/ es una franquicia: agregar una no requiere tocar código.
const franchiseModules = import.meta.glob<Franchise>("../data/franchises/*.json", { eager: true, import: "default" });

export const catalog: Catalog = {
  titles: titlesJson as Title[],
  franchises: Object.values(franchiseModules),
};

export const catalogIndex = buildIndex(catalog);
