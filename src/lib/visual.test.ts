import { buildIndex } from "./catalogIndex";
import { buildGraph, neighbors, titleNodeId } from "./graph";
import { buildTimeline } from "./timeline";
import { makeCatalog, title } from "../test/fixtures";
import type { Franchise } from "./types";

describe("buildTimeline", () => {
  const catalog = makeCatalog();
  const franchise = catalog.franchises[0]!;
  const titlesById = new Map(catalog.titles.map((t) => [t.id, t]));

  it("un carril por continuidad, en orden in-universe, y la rama empieza después de su origen", () => {
    const { lanes, width } = buildTimeline(franchise, titlesById);
    expect(lanes.map((l) => [l.continuity.id, l.depth, l.items.map((i) => `${i.title.id}@${i.slot}`)])).toEqual([
      ["main", 0, ["b-2003@0", "a-2001@1", "c-2005@2"]],
      ["alt", 1, ["alt-2004@2"]],
    ]);
    expect(lanes[1]!.branch).toEqual({ lane: 0, slot: 1 });
    expect(width).toBe(3);
  });

  it("si el origen está oculto, la rama es un carril propio desde el principio", () => {
    const { lanes } = buildTimeline(franchise, titlesById, ["main"]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0]).toMatchObject({ depth: 0, branch: undefined });
    expect(lanes[0]!.items[0]!.slot).toBe(0);
  });

  it("sin chronoOrder, ordena por estreno", () => {
    const f: Franchise = {
      ...franchise,
      entries: franchise.entries.map((e) => ({ ...e, chronoOrder: undefined })),
    };
    const { lanes } = buildTimeline(f, titlesById);
    expect(lanes[0]!.items.map((i) => i.title.id)).toEqual(["a-2001", "b-2003", "c-2005"]);
  });
});

describe("buildGraph", () => {
  const catalog = makeCatalog();
  const franchise = catalog.franchises[0]!;
  franchise.tags = { characters: [{ id: "hero", name: { es: "Héroe", en: "Hero" } }], teams: [{ id: "team", name: "Team" }] };
  franchise.entries[0]!.characters = ["hero"];
  franchise.entries[1]!.characters = ["hero"];
  franchise.entries[1]!.teams = ["team"];
  catalog.titles.push(title("x-2010", "2010-01-01"));
  const other: Franchise = {
    ...structuredClone(franchise),
    id: "other",
    continuities: [{ id: "main", name: "Main", canonLevel: "main" }],
    entries: [
      { titleId: "x-2010", continuityId: "main", importance: "essential" },
      { titleId: "a-2001", continuityId: "main", importance: "essential" },
    ],
    routes: [],
  };
  catalog.franchises.push(other);
  franchise.routes.push({ id: "vs", name: "VS", description: "", kind: "theme", titleIds: ["x-2010"] });
  const index = buildIndex(catalog);

  it("une títulos con personajes, equipos y continuidades de una franquicia", () => {
    const g = buildGraph(index, { franchiseIds: ["test"] });
    expect(g.nodes.filter((n) => n.kind === "title")).toHaveLength(4);
    expect(g.nodes.some((n) => n.kind === "franchise")).toBe(false);
    expect(neighbors(g, "p:test:hero").sort()).toEqual([titleNodeId("a-2001"), titleNodeId("b-2003")]);
    expect(neighbors(g, "g:test:team")).toEqual([titleNodeId("b-2003")]);
    expect(neighbors(g, titleNodeId("alt-2004"))).toEqual(["c:test:alt"]);
  });

  it("respeta las continuidades ocultas y los tipos de nodo elegidos", () => {
    const g = buildGraph(index, { franchiseIds: ["test"], hiddenContinuities: { test: ["alt"] }, characters: false, continuities: false });
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["g:test:team", "t:a-2001", "t:b-2003", "t:c-2005"]);
  });

  it("con varias franquicias marca los crossovers (entries y rutas)", () => {
    const g = buildGraph(index, { franchiseIds: ["test", "other"] });
    const crossovers = g.nodes.filter((n) => n.crossover).map((n) => n.titleId).sort();
    expect(crossovers).toEqual(["a-2001", "x-2010"]);
    expect(neighbors(g, titleNodeId("x-2010"))).toContain("f:test");
    // Una arista no se repite.
    const keys = g.edges.map((e) => [e.source, e.target].sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
