import { evaluateAchievements } from "./achievements";
import { buildIndex } from "./catalogIndex";
import { effectiveEpisodes, seasonsPatch } from "./episodes";
import { pendingUnits } from "./planner";
import type { ProgressDoc } from "./progressStore";
import { validateCatalog } from "./validateCatalog";
import { isUnitWatched, parseUnitKey, unitKey, unitReleaseDate, watchedPredicate } from "./units";
import { makeCatalog, title } from "../test/fixtures";
import type { Catalog, Title } from "./types";

const show = title("show-2002", "2002-06-01", {
  tmdbType: "tv",
  kind: "series",
  runtimeMin: 250,
  seasons: [
    { number: 1, episodes: 3, airDate: "2002-06-01" },
    { number: 2, episodes: 2, airDate: "2006-01-01" },
  ],
});
const doc = (extra: Partial<ProgressDoc>): ProgressDoc => ({ status: "watching", rewatchCount: 0, updatedAt: "2026-01-01T00:00:00Z", ...extra });

describe("unidades", () => {
  it("clave de temporada ida y vuelta", () => {
    expect(unitKey("loki-2021", 2)).toBe("loki-2021#2");
    expect(parseUnitKey("loki-2021#2")).toEqual({ titleId: "loki-2021", season: 2 });
    expect(parseUnitKey("loki-2021")).toEqual({ titleId: "loki-2021" });
  });

  it("estreno de temporada: su fecha; sin fecha, la T2+ de una serie en emisión todavía no", () => {
    expect(unitReleaseDate(show, 2)).toBe("2006-01-01");
    const noDates = { ...show, seasons: show.seasons!.map(({ airDate: _a, ...s }) => s) };
    expect(unitReleaseDate(noDates, 2)).toBe("2002-06-01");
    expect(unitReleaseDate({ ...noDates, ongoing: true }, 2)).toBe("9999-12-31");
  });

  it("una temporada está vista con el título visto o con todos sus episodios", () => {
    expect(isUnitWatched(doc({ status: "watched" }), 2)).toBe(true);
    expect(isUnitWatched(doc({ episodes: { "2": [1, 2] } }), 2, 2)).toBe(true);
    expect(isUnitWatched(doc({ episodes: { "2": [1] } }), 2, 2)).toBe(false);
    const isWatched = watchedPredicate({ [show.id]: doc({ episodes: { "1": [1, 2, 3] } }) }, new Map([[show.id, show]]));
    expect([isWatched(show.id, 1), isWatched(show.id, 2), isWatched(show.id)]).toEqual([true, false, false]);
  });
});

describe("marcar temporadas", () => {
  it("una temporada marca sus episodios; todas, la serie", () => {
    const p1 = seasonsPatch(show, undefined, [1], true)!;
    expect(p1).toEqual({ episodes: { "1": [1, 2, 3] }, status: "watching" });
    expect(seasonsPatch(show, doc({ episodes: p1.episodes }), [2], true)!.status).toBe("watched");
  });

  it("desmarcar una temporada de una serie vista entera deja las demás", () => {
    const p = seasonsPatch(show, doc({ status: "watched" }), [2], false)!;
    expect(p).toEqual({ episodes: { "1": [1, 2, 3] }, status: "watching" });
  });

  it("los episodios efectivos de una serie vista entera son todos", () => {
    expect(effectiveEpisodes(show, doc({ status: "watched" }))).toEqual({ "1": [1, 2, 3], "2": [1, 2] });
  });
});

describe("planificador por temporada", () => {
  it("una temporada en la meta agenda solo sus episodios, con su fecha", () => {
    const units = pendingUnits([{ title: show, season: 2 }], {});
    expect(units.map((u) => [u.season, u.episode, u.releaseDate])).toEqual([
      [2, 1, "2006-01-01"],
      [2, 2, "2006-01-01"],
    ]);
  });
});

describe("validador con temporadas", () => {
  const withChange = (fn: (c: Catalog) => void) => {
    const c = makeCatalog();
    c.titles.push(show);
    c.franchises[0]!.entries.push(
      { titleId: show.id, season: 1, continuityId: "main", importance: "optional", chronoOrder: 5 },
      { titleId: show.id, season: 2, continuityId: "main", importance: "optional", chronoOrder: 6 },
    );
    fn(c);
    return validateCatalog(c).join("\n");
  };

  it("acepta una serie repartida por temporadas", () => {
    expect(withChange(() => undefined)).toBe("");
  });

  it("exige todas las temporadas, que existan y sin mezclar con el título entero", () => {
    expect(withChange((c) => c.franchises[0]!.entries.pop())).toMatch(/faltan entries de las temporadas 2/);
    expect(withChange((c) => (c.franchises[0]!.entries.at(-1)!.season = 3))).toMatch(/no tiene temporada 3/);
    expect(withChange((c) => c.franchises[0]!.entries.push({ titleId: show.id, continuityId: "main", importance: "optional" }))).toMatch(
      /por temporada y también del título entero/,
    );
  });

  it("revisa temporadas en rutas y líneas de tiempo compartidas", () => {
    expect(
      withChange((c) => c.franchises[0]!.routes.push({ id: "r", name: "R", description: "", kind: "theme", titleIds: ["show-2002#9"] })),
    ).toMatch(/no tiene temporada 9/);
    expect(withChange((c) => (c.franchises[0]!.continuities[1]!.timelineOf = "nope"))).toMatch(/timelineOf "nope" no existe/);
    // Con línea compartida, un chronoOrder repetido entre continuidades es un error.
    expect(withChange((c) => (c.franchises[0]!.continuities[1]!.timelineOf = "main"))).toMatch(/chronoOrder 10 repetido en "main"/);
  });
});

/** Una serie con la T1 en el grupo g1 y la T2 en g2; vista solo la T1: ¿g1 y g2 completos? */
function achievementsOf(show: Title): boolean[] {
  const c = makeCatalog();
  c.titles.push(show);
  const f = c.franchises[0]!;
  f.entries = [
    { titleId: show.id, season: 1, continuityId: "main", importance: "optional", group: "g1" },
    { titleId: show.id, season: 2, continuityId: "main", importance: "optional", group: "g2" },
  ];
  const progress = { [show.id]: { status: "watching" as const, rewatchCount: 0, updatedAt: "2026-01-01T00:00:00Z", episodes: { "1": [1, 2, 3] } } };
  const rule = (group: string) => ({ id: group, name: group, description: "", icon: "star", rule: { type: "complete-group" as const, franchiseId: f.id, group } });
  return evaluateAchievements([rule("g1"), rule("g2")], { index: buildIndex(c), progress, today: "2030-01-01" }).map((s) => s.done);
}

describe("logros por temporada", () => {
  it("completar un grupo con una temporada no exige las otras", () => {
    expect(achievementsOf(show)).toEqual([true, false]);
  });
});
