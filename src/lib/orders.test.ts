import { computeOrder, nextUp, resolveOrder, CUSTOM_ORDER_ID, watchedUpTo } from "./orders";
import { buildIndex } from "./catalogIndex";
import { makeCatalog } from "../test/fixtures";

const catalog = makeCatalog();
const franchise = catalog.franchises[0]!;
const { titlesById } = buildIndex(catalog);
const ids = (orderId: string, opts = {}, custom?: string[]) =>
  computeOrder(franchise, resolveOrder(franchise, orderId, custom), titlesById, opts).map((i) => i.title.id);

describe("computeOrder", () => {
  it("release: por fecha de estreno", () => {
    expect(ids("release")).toEqual(["a-2001", "b-2003", "alt-2004", "c-2005"]);
  });

  it("chronological: continuidades en orden declarado y chronoOrder dentro de cada una", () => {
    expect(ids("chrono")).toEqual(["b-2003", "a-2001", "c-2005", "alt-2004"]);
  });

  it("chronological: títulos sin chronoOrder van al final de su continuidad", () => {
    const f = structuredClone(franchise);
    delete f.entries.find((e) => e.titleId === "b-2003")!.chronoOrder;
    const order = resolveOrder(f, "chrono");
    expect(computeOrder(f, order, titlesById).map((i) => i.title.id)).toEqual(["a-2001", "c-2005", "b-2003", "alt-2004"]);
  });

  it("grouped: por grupo en el orden de groupLabels y por estreno dentro del grupo", () => {
    const items = computeOrder(franchise, resolveOrder(franchise, "grouped"), titlesById);
    expect(items.map((i) => [i.title.id, i.section])).toEqual([
      ["a-2001", "g1"], ["c-2005", "g1"], ["b-2003", "g2"], ["alt-2004", "g2"],
    ]);
  });

  it("curated: exactamente la lista declarada", () => {
    expect(ids("curated")).toEqual(["c-2005", "a-2001"]);
  });

  it("custom: respeta la lista guardada y agrega títulos nuevos al final", () => {
    expect(ids(CUSTOM_ORDER_ID, {}, ["c-2005", "ghost", "a-2001"])).toEqual(["c-2005", "a-2001", "b-2003", "alt-2004"]);
  });

  it("ocultar una continuidad no cambia la posición de los demás", () => {
    const all = computeOrder(franchise, resolveOrder(franchise, "release"), titlesById);
    const filtered = computeOrder(franchise, resolveOrder(franchise, "release"), titlesById, { hiddenContinuities: ["alt"] });
    expect(filtered.map((i) => i.title.id)).toEqual(["a-2001", "b-2003", "c-2005"]);
    expect(filtered.find((i) => i.title.id === "c-2005")!.position).toBe(all.find((i) => i.title.id === "c-2005")!.position);
  });
});

describe("resolveOrder", () => {
  it("cae al orden de estreno si el id no existe", () => {
    expect(resolveOrder(franchise, "nope").id).toBe("release");
  });
});

describe("nextUp", () => {
  it("devuelve el primer título no visto del orden", () => {
    const items = computeOrder(franchise, resolveOrder(franchise, "chrono"), titlesById);
    expect(nextUp(items, (id) => id === "b-2003")?.title.id).toBe("a-2001");
    expect(nextUp(items, () => true)).toBeUndefined();
  });
});

describe("progreso vs. orden curado", () => {
  it("el orden curado solo lista algunos títulos: el progreso se calcula sobre todos", () => {
    const curated = computeOrder(franchise, resolveOrder(franchise, "curated"), titlesById);
    const all = computeOrder(franchise, resolveOrder(franchise, "release"), titlesById);
    expect(curated.length).toBeLessThan(all.length);
  });
});

describe("watchedUpTo", () => {
  it("devuelve lo no visto y ya estrenado hasta el título, inclusive", () => {
    const items = computeOrder(franchise, resolveOrder(franchise, "release"), titlesById);
    // release: a-2001, b-2003, alt-2004, c-2005
    expect(watchedUpTo(items, "alt-2004", (id) => id === "b-2003", "2030-01-01")).toEqual(["a-2001", "alt-2004"]);
    expect(watchedUpTo(items, "c-2005", () => false, "2004-06-01")).toEqual(["a-2001", "b-2003", "alt-2004"]);
    expect(watchedUpTo(items, "nope", () => false, "2030-01-01")).toEqual([]);
  });
});
