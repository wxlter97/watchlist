// Sin sinopsis (ver catalogSplit en vite.config.ts y overviews.ts).
import titlesJson from "virtual:catalog-titles";
import type { Catalog, Franchise } from "./types";
import { buildIndex } from "./catalogIndex";

// Cada archivo en data/franchises/ es una franquicia: agregar una no requiere tocar código.
const franchiseModules = import.meta.glob<Franchise>("../data/franchises/*.json", { eager: true, import: "default" });

export const catalog: Catalog = {
  titles: titlesJson,
  franchises: Object.values(franchiseModules),
};

export const catalogIndex = buildIndex(catalog);
