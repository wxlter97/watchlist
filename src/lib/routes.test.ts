import { buildIndex } from "./catalogIndex";
import { resolveRoute, routeProgress } from "./routes";
import { makeCatalog, title } from "../test/fixtures";
import type { Franchise } from "./types";

const catalog = makeCatalog();
catalog.titles[0]!.runtimeMin = 100;
catalog.titles[2]!.runtimeMin = 90;
catalog.titles.push(title("other-2010", "2010-01-01", { runtimeMin: 120 }));
const franchise = catalog.franchises[0]!;
const other: Franchise = {
  ...structuredClone(franchise),
  id: "other",
  entries: [{ titleId: "other-2010", continuityId: "main", importance: "essential" }],
  routes: [],
};
catalog.franchises.push(other);
franchise.routes.push({
  id: "prep-c-2005",
  name: "Prep",
  description: "",
  kind: "prep",
  targetTitleId: "c-2005",
  titleIds: ["a-2001", "other-2010", "b-2003"],
});
const index = buildIndex(catalog);

describe("resolveRoute", () => {
  it("respeta el orden de la ruta y cruza franquicias", () => {
    const items = resolveRoute(franchise.routes[0]!, franchise, index);
    expect(items.map((i) => [i.title.id, i.position])).toEqual([
      ["a-2001", 1],
      ["other-2010", 2],
      ["b-2003", 3],
    ]);
    // El título de otra franquicia trae la pertenencia de esa franquicia.
    expect(items[1]!.entry?.importance).toBe("essential");
  });
});

describe("routeProgress", () => {
  it("cuenta vistos y minutos pendientes", () => {
    const items = resolveRoute(franchise.routes[0]!, franchise, index);
    expect(routeProgress(items, (id) => id === "a-2001")).toEqual({
      watched: 1,
      total: 3,
      remainingMin: 120,
      unknownRuntime: 1,
    });
  });
});

describe("buildIndex", () => {
  it("indexa rutas por título y preparaciones por objetivo", () => {
    expect(index.routesByTitle.get("other-2010")?.map((r) => r.route.id)).toEqual(["prep-c-2005"]);
    expect(index.prepByTarget.get("c-2005")?.map((r) => r.route.id)).toEqual(["prep-c-2005"]);
  });
});
