import { buildIndex } from "./catalogIndex";
import { catalog as realCatalog } from "./catalogFull";
import { recapIds, recapSources } from "./recaps";
import { makeCatalog } from "../test/fixtures";

const index = buildIndex(makeCatalog());

describe("recaps", () => {
  // Fixture: c-2005 (main) tiene antes b-2003 y a-2001 (a-2001 el más cercano); alt-2004 es otra continuidad que sale de a-2001.
  it("lista todo lo previo de su linaje, visto o no, y nada de otra línea", () => {
    expect(recapSources("c-2005", index).map((s) => s.title.id)).toEqual(["a-2001", "b-2003"]);
    // c-2005 es posterior a la rama alt: no es requisito de alt-2004.
    expect(recapSources("alt-2004", index).map((s) => s.title.id)).not.toContain("c-2005");
  });

  it("incluye el motivo y va de más a menos importante", () => {
    const c = makeCatalog();
    const f = c.franchises[0]!;
    f.entries.find((e) => e.titleId === "b-2003")!.importance = "optional";
    f.entries.find((e) => e.titleId === "a-2001")!.importance = "essential";
    f.entries.find((e) => e.titleId === "a-2001")!.chronoNote = "Antes de todo";
    const sources = recapSources("c-2005", buildIndex(c));
    expect(sources.map((s) => [s.title.id, s.importance, s.inMinimum])).toEqual([
      ["a-2001", "essential", true],
      ["b-2003", "optional", false],
    ]);
    expect(sources[0]!.chronoNote).toBe("Antes de todo");
    expect(sources[0]!.continuity?.id).toBe("main");
  });

  it("nada antes del primer título", () => {
    expect(recapSources("b-2003", index)).toEqual([]);
  });

  it("cada recap existe en ambos idiomas y es de un título del catálogo", () => {
    const es = recapIds("es").sort();
    expect(recapIds("en").sort()).toEqual(es);
    const ids = new Set(realCatalog.titles.map((t) => t.id));
    expect(es.filter((id) => !ids.has(id))).toEqual([]);
    expect(es.length).toBeGreaterThan(0);
  });
});
