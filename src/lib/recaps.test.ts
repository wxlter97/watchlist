import { buildIndex } from "./catalogIndex";
import { catalog as realCatalog } from "./catalogFull";
import type { ProgressDoc } from "./progressStore";
import { recapIds, recapsBefore } from "./recaps";
import { makeCatalog } from "../test/fixtures";

const index = buildIndex(makeCatalog());
const w: ProgressDoc = { status: "watched", rewatchCount: 0, updatedAt: "" };

describe("recaps", () => {
  it("solo títulos previos, vistos y con recap, en el orden activo", () => {
    const has = (id: string) => id !== "b-2003";
    // Estreno: a-2001, b-2003, alt-2004, c-2005.
    const progress = { "a-2001": w, "b-2003": w, "alt-2004": w };
    expect(recapsBefore("c-2005", { index, progress, franchiseState: {}, has })).toEqual(["a-2001", "alt-2004"]);
    // Cronológico: b-2003, a-2001, c-2005, alt-2004 → antes de c: b (sin recap) y a.
    expect(recapsBefore("c-2005", { index, progress, franchiseState: { test: { lastOrderId: "chrono", updatedAt: "" } }, has })).toEqual([
      "a-2001",
    ]);
  });

  it("nunca incluye lo no visto", () => {
    expect(recapsBefore("c-2005", { index, progress: {}, franchiseState: {}, has: () => true })).toEqual([]);
  });

  it("si el orden curado no incluye el título, usa el cronológico", () => {
    const state = { test: { lastOrderId: "curated", updatedAt: "" } }; // curated: c-2005, a-2001
    expect(recapsBefore("b-2003", { index, progress: { "a-2001": w }, franchiseState: state, has: () => true })).toEqual([]);
    expect(recapsBefore("alt-2004", { index, progress: { "a-2001": w, "c-2005": w }, franchiseState: state, has: () => true })).toEqual([
      "a-2001",
      "c-2005",
    ]);
  });

  it("cada recap existe en ambos idiomas y es de un título del catálogo", () => {
    const es = recapIds("es").sort();
    expect(recapIds("en").sort()).toEqual(es);
    const ids = new Set(realCatalog.titles.map((t) => t.id));
    expect(es.filter((id) => !ids.has(id))).toEqual([]);
    expect(es.length).toBeGreaterThan(0);
  });
});
