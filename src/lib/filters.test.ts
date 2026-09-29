import { activeFilterCount, applyFilters, effectiveHidden, kindsIn, NO_FILTERS, toggleContinuity } from "./filters";
import { buildIndex } from "./catalogIndex";
import { computeOrder, resolveOrder } from "./orders";
import { makeCatalog, title } from "../test/fixtures";

const catalog = makeCatalog();
catalog.titles.push(title("s-2006", "2006-01-01", { kind: "series" }));
const franchise = catalog.franchises[0]!;
franchise.entries.push({ titleId: "s-2006", continuityId: "main", importance: "optional", chronoOrder: 40, characters: ["hero"], teams: ["team"] });
franchise.entries[0]!.characters = ["hero"];
franchise.entries[0]!.importance = "essential";
const index = buildIndex(catalog);
const items = computeOrder(franchise, resolveOrder(franchise, "release"), index.titlesById);
const ids = (f = NO_FILTERS, watched: string[] = []) => applyFilters(items, f, (id) => watched.includes(id)).map((i) => i.title.id);

describe("applyFilters", () => {
  it("sin filtros devuelve todo", () => {
    expect(ids()).toEqual(["a-2001", "b-2003", "alt-2004", "c-2005", "s-2006"]);
  });

  it("filtra por tipo, importancia, personaje y equipo", () => {
    expect(ids({ ...NO_FILTERS, kinds: ["series"] })).toEqual(["s-2006"]);
    expect(ids({ ...NO_FILTERS, importance: ["essential", "optional"] })).toEqual(["a-2001", "s-2006"]);
    expect(ids({ ...NO_FILTERS, character: "hero" })).toEqual(["a-2001", "s-2006"]);
    expect(ids({ ...NO_FILTERS, team: "team" })).toEqual(["s-2006"]);
  });

  it("filtra por estado", () => {
    expect(ids({ ...NO_FILTERS, status: "watched" }, ["b-2003"])).toEqual(["b-2003"]);
    expect(ids({ ...NO_FILTERS, status: "pending" }, ["b-2003"])).toEqual(["a-2001", "alt-2004", "c-2005", "s-2006"]);
  });

  it("filtrar no cambia la posición de cada título", () => {
    const filtered = applyFilters(items, { ...NO_FILTERS, kinds: ["series"] }, () => false);
    expect(filtered[0]!.position).toBe(5);
  });

  it("cuenta los filtros activos", () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount({ kinds: ["movie"], importance: [], status: "pending", team: "team" })).toBe(3);
  });
});

describe("effectiveHidden / toggleContinuity", () => {
  const f = structuredClone(franchise);
  f.continuities[1]!.hiddenByDefault = true;

  it("usa los valores por defecto sin excepciones guardadas", () => {
    expect(effectiveHidden(f)).toEqual(["alt"]);
  });

  it("guarda solo excepciones y se puede volver al valor por defecto", () => {
    const showAlt = toggleContinuity(f, "alt");
    expect(showAlt).toEqual({ hiddenContinuities: [], shownContinuities: ["alt"] });
    expect(effectiveHidden(f, showAlt.hiddenContinuities, showAlt.shownContinuities)).toEqual([]);

    const hideMain = toggleContinuity(f, "main", showAlt.hiddenContinuities, showAlt.shownContinuities);
    expect(effectiveHidden(f, hideMain.hiddenContinuities, hideMain.shownContinuities)).toEqual(["main"]);

    const back = toggleContinuity(f, "alt", hideMain.hiddenContinuities, hideMain.shownContinuities);
    expect(effectiveHidden(f, back.hiddenContinuities, back.shownContinuities)).toEqual(["main", "alt"]);
  });

  it("una continuidad nueva oculta por defecto sigue oculta aunque haya excepciones guardadas", () => {
    const g = structuredClone(f);
    g.continuities.push({ id: "new", name: "New", canonLevel: "alternate", hiddenByDefault: true });
    expect(effectiveHidden(g, ["main"], ["alt"])).toEqual(["main", "new"]);
  });
});

describe("kindsIn", () => {
  it("lista solo los tipos presentes, en orden estable", () => {
    expect(kindsIn(franchise, (id) => index.titlesById.get(id)?.kind)).toEqual(["movie", "series"]);
  });
});
