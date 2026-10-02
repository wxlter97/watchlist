import { computeOrder, nextUp, resolveOrder, CUSTOM_ORDER_ID, watchedUpTo } from "./orders";
import { buildIndex } from "./catalogIndex";
import { makeCatalog, title } from "../test/fixtures";

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

  it("curated: las continuidades ocultas no le quitan títulos (el orden ya eligió qué incluye)", () => {
    expect(ids("curated", { hiddenContinuities: ["main"] })).toEqual(["c-2005", "a-2001"]);
    expect(ids("release", { hiddenContinuities: ["alt"] })).not.toContain("alt-2004");
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

describe("computeOrder: casos borde", () => {
  it("ignora entries cuyo título no está en el catálogo", () => {
    const f = structuredClone(franchise);
    f.entries.push({ titleId: "ghost", continuityId: "main", importance: "optional" });
    expect(computeOrder(f, resolveOrder(f, "release"), titlesById)).toHaveLength(4);
  });

  it("grouped: lo que no tiene grupo, o tiene uno sin etiqueta, va al final sin sección", () => {
    const f = structuredClone(franchise);
    delete f.entries[0]!.group; // a-2001
    f.entries[2]!.group = "g9"; // c-2005
    const items = computeOrder(f, resolveOrder(f, "grouped"), titlesById);
    expect(items.map((i) => [i.title.id, i.section])).toEqual([
      ["b-2003", "g2"], ["alt-2004", "g2"], ["a-2001", undefined], ["c-2005", undefined],
    ]);
  });

  it("chronological: una continuidad no declarada va al final; empates por estreno y luego por id", () => {
    const f = structuredClone(franchise);
    f.entries[0]!.continuityId = "lost"; // a-2001
    for (const e of f.entries) delete e.chronoOrder;
    expect(computeOrder(f, resolveOrder(f, "chrono"), titlesById).map((i) => i.title.id)).toEqual([
      "b-2003", "c-2005", "alt-2004", "a-2001",
    ]);
  });

  it("es determinista: el orden de las entries en el JSON no cambia el resultado", () => {
    const f = structuredClone(franchise);
    f.entries.reverse();
    for (const id of ["release", "chrono", "grouped", "curated"]) {
      expect(computeOrder(f, resolveOrder(f, id), titlesById).map((i) => i.title.id)).toEqual(ids(id));
    }
  });
});

describe("resolveOrder", () => {
  it("cae al orden de estreno si el id no existe", () => {
    expect(resolveOrder(franchise, "nope").id).toBe("release");
    expect(resolveOrder(franchise, undefined).id).toBe("release");
  });

  it("sin orden de estreno cae al primero; custom sin lista guardada queda vacío", () => {
    const f = { ...franchise, orders: franchise.orders.filter((o) => o.type !== "release") };
    expect(resolveOrder(f, "nope").id).toBe("chrono");
    expect(resolveOrder(franchise, CUSTOM_ORDER_ID)).toEqual({ id: CUSTOM_ORDER_ID, type: "custom", titleIds: [] });
  });
});

describe("nextUp", () => {
  it("devuelve el primer título no visto del orden", () => {
    const items = computeOrder(franchise, resolveOrder(franchise, "chrono"), titlesById);
    expect(nextUp(items, (id) => id === "b-2003")?.title.id).toBe("a-2001");
    expect(nextUp(items, () => true)).toBeUndefined();
  });

  it("lo abandonado no frena el avance: se salta al siguiente", () => {
    const items = computeOrder(franchise, resolveOrder(franchise, "chrono"), titlesById);
    const first = nextUp(items, () => false)!;
    const skipped = nextUp(items, () => false, (id) => id === first.title.id);
    expect(skipped?.title.id).not.toBe(first.title.id);
    expect(skipped?.position).toBeGreaterThan(first.position);
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
    const keys = (list: { key: string }[]) => list.map((i) => i.key);
    expect(keys(watchedUpTo(items, "alt-2004", (id) => id === "b-2003", "2030-01-01"))).toEqual(["a-2001", "alt-2004"]);
    expect(keys(watchedUpTo(items, "c-2005", () => false, "2004-06-01"))).toEqual(["a-2001", "b-2003", "alt-2004"]);
    expect(watchedUpTo(items, "nope", () => false, "2030-01-01")).toEqual([]);
  });
});

describe("temporadas como unidades", () => {
  // Una serie con dos temporadas repartidas: la T1 antes de c-2005 y la T2 al final.
  const c = makeCatalog();
  c.titles.push(title("show-2002", "2002-06-01", { tmdbType: "tv", kind: "series", seasons: [
    { number: 1, episodes: 3, airDate: "2002-06-01" },
    { number: 2, episodes: 2, airDate: "2006-01-01" },
  ] }));
  const f = c.franchises[0]!;
  f.entries.push(
    { titleId: "show-2002", season: 1, continuityId: "main", importance: "optional", chronoOrder: 25 },
    { titleId: "show-2002", season: 2, continuityId: "main", importance: "optional", chronoOrder: 40 },
  );
  // Una continuidad que comparte la línea principal se intercala en vez de ir al final.
  f.continuities[1]!.timelineOf = "main";
  const { titlesById: ids } = buildIndex(c);
  const keysOf = (orderId: string, custom?: string[]) =>
    computeOrder(f, resolveOrder(f, orderId, custom), ids).map((i) => i.key);

  it("el estreno usa la fecha de cada temporada", () => {
    expect(keysOf("release")).toEqual(["a-2001", "show-2002#1", "b-2003", "alt-2004", "c-2005", "show-2002#2"]);
  });

  it("el cronológico intercala temporadas y continuidades que comparten línea de tiempo", () => {
    // b-2003 (10) y alt-2004 (10, comparte "main") empatan: desempata el estreno.
    expect(keysOf("chrono")).toEqual(["b-2003", "alt-2004", "a-2001", "show-2002#1", "c-2005", "show-2002#2"]);
  });

  it("un id de título en un orden guardado trae todas sus temporadas; uno de temporada, solo esa", () => {
    expect(keysOf(CUSTOM_ORDER_ID, ["show-2002", "a-2001"]).slice(0, 3)).toEqual(["show-2002#1", "show-2002#2", "a-2001"]);
    expect(keysOf(CUSTOM_ORDER_ID, ["show-2002#2", "a-2001"]).slice(0, 3)).toEqual(["show-2002#2", "a-2001", "show-2002#1"]);
  });

  it("siguiente y visto hasta aquí van por temporada", () => {
    const items = computeOrder(f, resolveOrder(f, "release"), ids);
    const watched = (id: string, season?: number) => id === "a-2001" || (id === "show-2002" && season === 1);
    expect(nextUp(items, watched)?.key).toBe("b-2003");
    expect(watchedUpTo(items, "show-2002#2", watched, "2030-01-01").map((i) => i.key)).toEqual(["b-2003", "alt-2004", "c-2005", "show-2002#2"]);
  });
});
