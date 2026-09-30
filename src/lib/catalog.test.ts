import {
  ALL_FRANCHISE_IDS,
  franchiseMetaById,
  franchiseMetas,
  franchisesForTitles,
  franchisesMentioning,
  loadAllFranchises,
  loadFranchise,
  useCatalogStore,
  withReferences,
} from "./catalog";
import { catalog, catalogIndex } from "./catalogFull";
import { effectiveHidden } from "./filters";
import { computeOrder, resolveOrder } from "./orders";
import { summarize, summarizeEntries } from "./progress";
import { parseUnitKey, unitReleaseDate } from "./units";

// El catálogo por partes (catalog.ts + catalogData en vite.config.ts) tiene que dar lo mismo
// que el catálogo entero.

const index = () => useCatalogStore.getState().index;

describe("manifiesto", () => {
  it("tiene cada franquicia con sus entries, continuidades y fechas", () => {
    expect(franchiseMetas.map((f) => f.id).sort()).toEqual(catalog.franchises.map((f) => f.id).sort());
    for (const f of catalog.franchises) {
      const meta = franchiseMetaById.get(f.id)!;
      expect(meta.accentColor).toBe(f.accentColor);
      expect(meta.continuities).toEqual(f.continuities);
      expect(meta.titles).toEqual(
        f.entries.map((e) => {
          const title = catalogIndex.titlesById.get(e.titleId)!;
          const base = { titleId: e.titleId, continuityId: e.continuityId, releaseDate: unitReleaseDate(title, e.season) };
          return e.season === undefined ? base : { ...base, season: e.season, seasonEpisodes: title.seasons!.find((s) => s.number === e.season)!.episodes };
        }),
      );
    }
  });

  it("el progreso del Hub (sin cargar) es el mismo que el de la franquicia cargada", () => {
    const watched = new Set(catalog.titles.filter((_, i) => i % 3 === 0).map((t) => t.id));
    const isWatched = (id: string) => watched.has(id);
    for (const f of catalog.franchises) {
      const hidden = effectiveHidden(f);
      const items = computeOrder(f, resolveOrder(f, "release"), catalogIndex.titlesById, { hiddenContinuities: hidden });
      expect(summarizeEntries(franchiseMetaById.get(f.id)!.titles, hidden, isWatched, "2026-09-29")).toEqual(summarize(items, isWatched, "2026-09-29"));
    }
  });
});

describe("carga por franquicia", () => {
  it("al arrancar no hay ninguna franquicia cargada", () => {
    expect(index().franchisesById.size).toBe(0);
  });

  it("cargar una franquicia trae sus títulos y los de sus rutas", async () => {
    const id = "terminator";
    await loadFranchise(id);
    await Promise.resolve(); // el índice se rehace en una microtarea
    const f = index().franchisesById.get(id)!;
    expect(f).toEqual(catalogIndex.franchisesById.get(id));
    for (const e of f.entries) expect(index().titlesById.has(e.titleId)).toBe(true);
    // Sin sinopsis: esas se cargan aparte.
    expect(index().titlesById.get("the-terminator-1984")!.overview).toBeUndefined();
    expect(useCatalogStore.getState().done.has(id)).toBe(true);
  });

  it("una franquicia que no existe queda resuelta, sin nada que esperar", async () => {
    await loadFranchise("nope");
    await Promise.resolve();
    expect(useCatalogStore.getState().done.has("nope")).toBe(true);
    expect(index().franchisesById.has("nope")).toBe(false);
  });

  it("withReferences alcanza para mostrar todas las rutas y órdenes curados de la franquicia", async () => {
    for (const f of catalog.franchises) {
      const ids = withReferences(f.id);
      await Promise.all(ids.map(loadFranchise));
      await Promise.resolve();
      const refs = [...f.routes.flatMap((r) => r.titleIds), ...f.orders.flatMap((o) => (o.type === "curated" ? o.titleIds : []))];
      for (const titleId of refs.map((k) => parseUnitKey(k).titleId)) {
        expect(index().titlesById.has(titleId)).toBe(true);
        // "Aparece en" del título de la ruta: la franquicia donde es entry también está cargada.
        expect(index().franchisesByTitle.get(titleId)?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("con todo cargado, el índice es el del catálogo entero", async () => {
    await loadAllFranchises();
    await Promise.resolve();
    const all = index();
    expect([...all.franchisesById.keys()].sort()).toEqual([...catalogIndex.franchisesById.keys()].sort());
    expect([...all.titlesById.keys()].sort()).toEqual([...catalogIndex.titlesById.keys()].sort());
    for (const [id, refs] of catalogIndex.franchisesByTitle) {
      expect(all.franchisesByTitle.get(id)!.map((r) => r.franchise.id)).toEqual(refs.map((r) => r.franchise.id));
    }
    expect(ALL_FRANCHISE_IDS).toHaveLength(catalog.franchises.length);
  });
});

describe("qué cargar", () => {
  it("franchisesForTitles pide una franquicia por título", () => {
    expect(franchisesForTitles(["the-terminator-1984", "avp-alien-vs-predator-2004"])).toEqual(["terminator", "alien"]);
  });

  it("franchisesMentioning incluye todas las que tienen al título, también en rutas", () => {
    expect(franchisesMentioning(["avp-alien-vs-predator-2004"])).toEqual(["alien", "predator"]);
    const crossRoute = catalog.franchises.flatMap((f) => f.routes.flatMap((r) => r.titleIds.map((t) => [f.id, parseUnitKey(t).titleId] as const)))
      .find(([fid, t]) => !catalogIndex.franchisesById.get(fid)!.entries.some((e) => e.titleId === t));
    if (crossRoute) expect(franchisesMentioning([crossRoute[1]])).toContain(crossRoute[0]);
  });
});

describe("la app no importa el catálogo entero", () => {
  it("solo los tests usan catalogFull", () => {
    const files = import.meta.glob<string>("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });
    const offenders = Object.entries(files)
      .filter(([path, source]) => !/\.test\.tsx?$/.test(path) && !path.endsWith("catalogFull.ts") && /from ["'][./]*(lib\/)?catalogFull["']/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
