import titlesJson from "../data/titles.json";
import { buildIndex } from "./catalogIndex";
import type { Catalog, Franchise, Title } from "./types";

// El catálogo entero, cargado de una vez. Solo para tests: la app lo carga por partes
// (catalog.ts) y un test verifica que ningún archivo de la app importe este módulo.

const franchiseModules = import.meta.glob<Franchise>("../data/franchises/*.json", { eager: true, import: "default" });

export const catalog: Catalog = {
  titles: titlesJson as Title[],
  franchises: Object.values(franchiseModules),
};

export const catalogIndex = buildIndex(catalog);
