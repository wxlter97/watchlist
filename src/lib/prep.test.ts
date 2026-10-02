import { buildIndex } from "./catalogIndex";
import { catalog, catalogIndex } from "./catalogFull";
import { parseRoutePath, prepLevelFor, prepUnits, routeUnits } from "./prep";
import { makeCatalog, title } from "../test/fixtures";

describe("prepUnits", () => {
  // Fixture (chrono): b-2003, a-2001, c-2005 en "main"; alt-2004 en "alt", que va después
  // de "main" en el cronológico: queda después del objetivo y no entra.
  const c = makeCatalog();
  const f = c.franchises[0]!;
  f.entries.find((e) => e.titleId === "a-2001")!.importance = "essential";
  c.titles.push(title("extra-1999", "1999-01-01"), title("target-2010", "2010-01-01"));
  c.franchises.push({ ...structuredClone(f), id: "other", entries: [{ titleId: "extra-1999", continuityId: "main", importance: "optional" }], routes: [] });
  f.entries.push({ titleId: "target-2010", continuityId: "main", importance: "essential", chronoOrder: 40 });
  const index = buildIndex(c);
  const keys = (level: "minimum" | "recommended" | "all") => prepUnits(f, "target-2010", level, index).map((i) => i.key);

  it("sin ruta curada: lo mínimo es lo esencial anterior; todo, lo que viene antes", () => {
    expect(keys("minimum")).toEqual(["a-2001"]);
    expect(keys("recommended")).toEqual(["b-2003", "a-2001", "c-2005"]);
    expect(keys("all")).toEqual(["b-2003", "a-2001", "c-2005"]);
  });

  it("con ruta curada: lo mínimo es la ruta; lo de fuera del cronológico va primero en los demás", () => {
    f.entries.find((e) => e.titleId === "b-2003")!.importance = "optional";
    f.routes.push({ id: "prep", name: "P", description: "", kind: "prep", targetTitleId: "target-2010", titleIds: ["extra-1999", "c-2005"] });
    const idx = buildIndex(c);
    const k = (level: "minimum" | "recommended" | "all") => prepUnits(f, "target-2010", level, idx).map((i) => i.key);
    expect(k("minimum")).toEqual(["extra-1999", "c-2005"]);
    expect(k("recommended")).toEqual(["extra-1999", "a-2001", "c-2005"]);
    expect(k("all")).toEqual(["extra-1999", "b-2003", "a-2001", "c-2005"]);
    expect(prepUnits(f, "target-2010", "all", idx).map((i) => i.position)).toEqual([1, 2, 3, 4]);
  });

  it("nada antes del primer título", () => {
    expect(prepUnits(f, "b-2003", "all", index)).toEqual([]);
  });
});

describe("linaje", () => {
  it("una línea temporal alternativa no es requisito: Destino oculto sigue a T2, no a T3", () => {
    const terminator = catalog.franchises.find((x) => x.id === "terminator")!;
    expect(prepUnits(terminator, "terminator-dark-fate-2019", "all", catalogIndex).map((i) => i.key)).toEqual([
      "the-terminator-1984",
      "terminator-2-judgment-day-1991",
    ]);
  });
});

describe("Prepárate para Avengers: Doomsday", () => {
  const marvel = catalog.franchises.find((x) => x.id === "marvel")!;
  const count = (level: "minimum" | "recommended" | "all") => prepUnits(marvel, "avengers-doomsday-2026", level, catalogIndex).length;

  it("lo mínimo es la lista oficial de Disney+: 15 títulos (Loki en dos temporadas)", () => {
    const min = prepUnits(marvel, "avengers-doomsday-2026", "minimum", catalogIndex);
    expect(new Set(min.map((i) => i.title.id)).size).toBe(15);
    expect(min[0]!.title.id).toBe("x-men-2000");
  });

  it("cada nivel contiene al anterior", () => {
    const [min, rec, all] = (["minimum", "recommended", "all"] as const).map((l) =>
      prepUnits(marvel, "avengers-doomsday-2026", l, catalogIndex).map((i) => i.key),
    );
    for (const k of min!) expect(rec).toContain(k);
    for (const k of rec!) expect(all).toContain(k);
    expect(count("all")).toBeGreaterThan(count("recommended"));
  });
});

describe("nivel y ruta guardados", () => {
  it("el nivel guardado manda; sin él, mínimo con ruta curada y recomendado sin ella", () => {
    expect(prepLevelFor(undefined, "t", true)).toBe("minimum");
    expect(prepLevelFor(undefined, "t", false)).toBe("recommended");
    expect(prepLevelFor({ prepLevels: { t: "all" } }, "t", true)).toBe("all");
    expect(prepLevelFor({ prepLevels: { t: "mucho" } }, "t", false)).toBe("recommended");
  });

  it("lee las rutas de la app", () => {
    expect(parseRoutePath("/f/marvel/r/x")).toEqual({ franchiseId: "marvel", kind: "r", ref: "x" });
    expect(parseRoutePath("/f/marvel/prep/y")).toEqual({ franchiseId: "marvel", kind: "prep", ref: "y" });
    expect(parseRoutePath("/t/y")).toBeUndefined();
  });

  it("Doomsday: la lista sigue el nivel que se eligió, no uno fijo", () => {
    const marvel = catalog.franchises.find((x) => x.id === "marvel")!;
    const path = "/f/marvel/r/prep-avengers-doomsday-2026";
    const at = (level?: string) => routeUnits(path, marvel, catalogIndex, level ? { updatedAt: "", prepLevels: { "avengers-doomsday-2026": level } } : undefined)!;
    expect(at().level).toBe("minimum");
    expect(at("all").level).toBe("all");
    expect(at("all").items.length).toBeGreaterThan(at("minimum").items.length);
    expect(at("recommended").items.length).toBeGreaterThan(at("minimum").items.length);
  });
});
