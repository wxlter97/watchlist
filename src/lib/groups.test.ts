import { buildIndex } from "./catalogIndex";
import { groupTitles, memberCounts, mirrorChanges, newInviteCode, nextTogether, type GroupProgressDoc } from "./groups";
import { makeCatalog, title } from "../test/fixtures";

const catalog = makeCatalog();
catalog.titles.push(title("future-2999", "2999-01-01"));
catalog.franchises[0]!.entries.push({ titleId: "future-2999", continuityId: "main", importance: "optional" });
catalog.franchises[0]!.continuities[1]!.hiddenByDefault = true;
catalog.franchises[0]!.routes.push({ id: "r", name: "R", description: "", kind: "theme", titleIds: ["c-2005", "a-2001"] });
const index = buildIndex(catalog);
const today = "2026-09-28";
const p = (watchedBy: Record<string, string>, watchedTogether = false): GroupProgressDoc => ({ watchedBy, watchedTogether, updatedAt: "" });

describe("grupos", () => {
  it("la meta es la ruta o la franquicia por estreno", () => {
    expect(groupTitles({ franchiseId: "test", routeId: "r" }, index).map((t) => t.id)).toEqual(["c-2005", "a-2001"]);
    expect(groupTitles({ franchiseId: "test" }, index).map((t) => t.id)).toEqual(["a-2001", "b-2003", "c-2005", "future-2999"]);
  });

  it("siguiente para ver juntos: salta lo visto por todos o juntos, y lo no estrenado", () => {
    const titles = groupTitles({ franchiseId: "test" }, index);
    const progress = {
      "a-2001": p({ ana: "x", beto: "x" }),
      "b-2003": p({ ana: "x" }, true),
      "c-2005": p({ ana: "x" }),
    };
    expect(nextTogether(titles, progress, ["ana", "beto"], today)?.id).toBe("c-2005");
    expect(nextTogether(titles, { ...progress, "c-2005": p({ ana: "x", beto: "x" }) }, ["ana", "beto"], today)).toBeUndefined();
  });

  it("cuenta lo visto por miembro", () => {
    const titles = groupTitles({ franchiseId: "test" }, index);
    expect(memberCounts(titles, { "a-2001": p({ ana: "x", beto: "x" }), "c-2005": p({ ana: "x" }) }, ["ana", "beto"])).toEqual({ ana: 2, beto: 1 });
  });

  it("publica lo visto que falta y quita lo desmarcado", () => {
    const titles = groupTitles({ franchiseId: "test" }, index);
    const mine = {
      "a-2001": { status: "watched", watchedAt: "2026-01-01T00:00:00Z", updatedAt: "" },
      "b-2003": { status: "watching", updatedAt: "" },
      "x-outside": { status: "watched", watchedAt: "2026-01-01T00:00:00Z", updatedAt: "" },
    };
    const progress = { "b-2003": p({ ana: "x" }), "c-2005": p({ beto: "x" }) };
    expect(mirrorChanges(titles, mine, progress, "ana")).toEqual({ add: { "a-2001": "2026-01-01T00:00:00Z" }, remove: ["b-2003"] });
  });

  it("códigos de invitación sin caracteres ambiguos", () => {
    expect(newInviteCode()).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });
});
