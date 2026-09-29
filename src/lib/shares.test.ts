import { buildIndex } from "./catalogIndex";
import type { ProgressDoc } from "./progressStore";
import { buildSnapshot, findShare, newShareId, publicShareUrl, type ShareDoc } from "./shares";
import { makeCatalog, title } from "../test/fixtures";

const catalog = makeCatalog();
catalog.titles.push(title("future-2999", "2999-01-01"));
catalog.franchises[0]!.entries.push({ titleId: "future-2999", continuityId: "main", importance: "optional" });
catalog.franchises[0]!.continuities[1]!.hiddenByDefault = true;
catalog.franchises[0]!.routes.push({ id: "r", name: "R", description: "", kind: "theme", titleIds: ["c-2005", "alt-2004"] });
const index = buildIndex(catalog);
const watched: ProgressDoc = { status: "watched", rewatchCount: 0, updatedAt: "2026-01-01T00:00:00Z" };
const ctx = (franchiseState = {}) => ({ index, progress: { "a-2001": watched, "alt-2004": watched }, franchiseState });

describe("buildSnapshot", () => {
  it("una ruta, en su orden y con sus vistos", () => {
    expect(buildSnapshot({ kind: "route", franchiseId: "test", refId: "r" }, ctx())).toEqual({
      titleIds: ["c-2005", "alt-2004"],
      watched: ["alt-2004"],
    });
  });

  it("el progreso: estrenados de las continuidades visibles, por estreno", () => {
    expect(buildSnapshot({ kind: "progress", franchiseId: "test", refId: "test" }, ctx())).toEqual({
      titleIds: ["a-2001", "b-2003", "c-2005"],
      watched: ["a-2001"],
    });
  });

  it("el orden personalizado del perfil, o nada si no tiene", () => {
    const state = { test: { customOrder: ["c-2005", "a-2001", "b-2003"], updatedAt: "" } };
    expect(buildSnapshot({ kind: "custom-order", franchiseId: "test", refId: "test" }, ctx(state))?.titleIds).toEqual([
      "c-2005",
      "a-2001",
      "b-2003",
      "future-2999",
    ]);
    expect(buildSnapshot({ kind: "custom-order", franchiseId: "test", refId: "test" }, ctx())).toBeUndefined();
  });

  it("lo que ya no existe no se comparte", () => {
    expect(buildSnapshot({ kind: "route", franchiseId: "test", refId: "nope" }, ctx())).toBeUndefined();
    expect(buildSnapshot({ kind: "progress", franchiseId: "nope", refId: "nope" }, ctx())).toBeUndefined();
  });
});

describe("links", () => {
  it("reusa el link del mismo perfil, tipo y referencia", () => {
    const base = { kind: "route", franchiseId: "test", refId: "r", profileId: "p1" } as ShareDoc;
    const shares = [{ ...base, id: "a" }, { ...base, id: "b", profileId: "p2" }];
    expect(findShare(shares, "p2", { kind: "route", franchiseId: "test", refId: "r" })?.id).toBe("b");
    expect(findShare(shares, "p1", { kind: "progress", franchiseId: "test", refId: "test" })).toBeUndefined();
  });

  it("ids aleatorios con prefijo de idioma en la URL", () => {
    const id = newShareId();
    expect(id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(newShareId()).not.toBe(id);
    expect(publicShareUrl("https://x.app", id, "en")).toBe(`https://x.app/en/s/${id}`);
  });
});
