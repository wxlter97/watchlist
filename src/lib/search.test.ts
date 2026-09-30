import { buildIndex } from "./catalogIndex";
import { catalog } from "./catalogFull";
import { matchScore, normalize, searchCatalog } from "./search";
import { upcomingReleases } from "./upcoming";
import { makeCatalog, title } from "../test/fixtures";

describe("normalize", () => {
  it("ignora mayúsculas, acentos y puntuación", () => {
    expect(normalize("Capitán América: El Primer Vengador")).toBe("capitan america el primer vengador");
    expect(normalize("Batman & Robin")).toBe("batman and robin");
    expect(normalize("Thunderbolts*")).toBe("thunderbolts");
  });
});

describe("matchScore", () => {
  it("prefiere exacto > empieza igual > palabra > contiene", () => {
    expect(matchScore(["Loki"], "loki")).toBe(0);
    expect(matchScore(["Logan: Wolverine"], "logan")).toBe(1);
    expect(matchScore(["X-Men Origins: Wolverine"], "wolverine")).toBe(2);
    expect(matchScore(["Spider-Man"], "ider")).toBe(3);
    expect(matchScore(["Thor"], "hulk")).toBeNull();
  });

  it("exige todas las palabras, en cualquier orden", () => {
    expect(matchScore(["The Dark Knight Rises"], "rises dark")).toBe(3);
    expect(matchScore(["The Dark Knight"], "dark rises")).toBeNull();
  });
});

describe("searchCatalog (catálogo real)", () => {
  const index = buildIndex(catalog);

  it("encuentra por el título en español sin acentos", () => {
    const { titles } = searchCatalog(index, "capitan america el primer", "es");
    expect(titles[0]?.id).toBe("captain-america-the-first-avenger-2011");
  });

  it("encuentra por el título original aunque la UI esté en español", () => {
    const { titles } = searchCatalog(index, "the dark knight rises", "es");
    expect(titles.map((t) => t.id)).toContain("the-dark-knight-rises-2012");
  });

  it("encuentra franquicias y rutas", () => {
    expect(searchCatalog(index, "star wars", "es").franchises.map((f) => f.id)).toContain("star-wars");
    expect(searchCatalog(index, "wolverine", "en").routes.map((r) => r.route.id)).toContain("wolverine");
  });
});

describe("upcomingReleases", () => {
  it("devuelve lo que se estrena en la ventana, ordenado y sin repetir", () => {
    const c = makeCatalog();
    c.titles.push(title("soon-2026", "2026-10-01"), title("later-2028", "2028-01-01"));
    c.franchises[0]!.entries.push(
      { titleId: "soon-2026", continuityId: "main", importance: "essential" },
      { titleId: "later-2028", continuityId: "main", importance: "essential" },
    );
    const index = buildIndex(c);
    const metas = new Map(c.franchises.map((f) => [f.id, { ...f, titles: f.entries }]));
    expect(upcomingReleases(metas, index.titlesById, ["test", "test"], "2026-09-28").map((u) => u.title.id)).toEqual(["soon-2026"]);
    expect(upcomingReleases(metas, index.titlesById, ["test"], "2026-09-28", 800).map((u) => u.title.id)).toEqual(["soon-2026", "later-2028"]);
  });
});
