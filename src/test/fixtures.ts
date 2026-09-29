import type { Catalog, Entry, Franchise, Title } from "../lib/types";

export const title = (id: string, releaseDate: string, extra: Partial<Title> = {}): Title => ({
  id, tmdbId: Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) + 1,
  tmdbType: "movie", title: id, kind: "movie", releaseDate, ...extra,
});

export const entry = (titleId: string, extra: Partial<Entry> = {}): Entry => ({
  titleId, continuityId: "main", importance: "recommended", ...extra,
});

/** Mini franquicia: estreno ≠ cronológico, dos continuidades y dos grupos. */
export function makeCatalog(): Catalog {
  const titles = [
    title("a-2001", "2001-01-01"),
    title("b-2003", "2003-01-01"),
    title("c-2005", "2005-01-01"),
    title("alt-2004", "2004-01-01"),
  ];
  const franchise: Franchise = {
    id: "test",
    name: "Test",
    description: "",
    accentColor: "#123456",
    continuities: [
      { id: "main", name: "Main", canonLevel: "main" },
      { id: "alt", name: "Alt", canonLevel: "alternate", branchesFrom: { continuityId: "main", afterTitleId: "a-2001" } },
    ],
    entries: [
      entry("a-2001", { chronoOrder: 20, group: "g1" }),
      entry("b-2003", { chronoOrder: 10, group: "g2" }),
      entry("c-2005", { chronoOrder: 30, group: "g1" }),
      entry("alt-2004", { continuityId: "alt", chronoOrder: 10, group: "g2" }),
    ],
    orders: [
      { id: "release", name: "Release", type: "release" },
      { id: "chrono", name: "Chrono", type: "chronological" },
      { id: "grouped", name: "Grouped", type: "grouped", groupLabels: { g1: "Uno", g2: "Dos" } },
      { id: "curated", name: "Curated", type: "curated", description: "", titleIds: ["c-2005", "a-2001"] },
    ],
    routes: [],
    tags: { characters: [], teams: [] },
  };
  return { titles, franchises: [franchise] };
}
