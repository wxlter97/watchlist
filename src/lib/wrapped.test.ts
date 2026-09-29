import { buildIndex } from "./catalogIndex";
import type { ProgressDoc } from "./progressStore";
import { computeWrapped, isWrappedSeason } from "./wrapped";
import { makeCatalog, title } from "../test/fixtures";

const catalog = makeCatalog();
for (const t of catalog.titles) t.runtimeMin = 100;
catalog.titles.push(
  title("show-2020", "2020-01-01", { tmdbType: "tv", kind: "series", runtimeMin: 400, seasons: [{ number: 1, episodes: 8 }] }),
);
catalog.franchises[0]!.entries.push({ titleId: "show-2020", continuityId: "main", importance: "optional" });
const index = buildIndex(catalog);

const doc = (at: string, extra: Partial<ProgressDoc> = {}): ProgressDoc => ({
  status: "watched",
  rewatchCount: 0,
  watchedAt: at,
  updatedAt: at,
  ...extra,
});

describe("computeWrapped", () => {
  const progress: Record<string, ProgressDoc> = {
    "a-2001": doc("2026-03-02T20:00:00", { rating: 4, rewatchCount: 2 }),
    "b-2003": doc("2026-03-03T20:00:00", { rating: 5 }),
    "c-2005": doc("2026-07-10T20:00:00", { rating: 5 }),
    "alt-2004": doc("2025-12-31T20:00:00", { rating: 5 }), // otro año
    "show-2020": { status: "watching", rewatchCount: 0, episodes: { 1: [1, 2] }, updatedAt: "2026-07-11T20:00:00" },
  };
  const w = computeWrapped(index, progress, { a: { unlockedAt: "2026-05-01T00:00:00Z" }, b: { unlockedAt: "2025-05-01T00:00:00Z" } }, 2026);

  it("suma lo terminado en el año (sin rewatches) y los episodios en curso", () => {
    expect(w.titles.map((t) => t.id)).toEqual(["a-2001", "b-2003", "c-2005"]);
    expect(w.minutes).toBe(300 + 100);
    expect(w.episodes).toBe(2);
  });

  it("mejor calificado con empate por el más reciente, mes más activo y franquicia", () => {
    expect(w.topTitle).toMatchObject({ title: { id: "c-2005" }, rating: 5 });
    expect(w.topMonth).toBe(3);
    expect(w.months[6]).toBe(2);
    expect(w.topFranchise?.franchise.id).toBe("test");
  });

  it("logros y racha del año", () => {
    expect(w.achievements).toEqual(["a"]);
    expect(w.bestStreak).toBe(2);
  });

  it("un año sin nada queda vacío", () => {
    const empty = computeWrapped(index, progress, {}, 2020);
    expect(empty).toMatchObject({ minutes: 0, titles: [], topMonth: undefined, topTitle: undefined, topFranchise: undefined, bestStreak: 0 });
  });

  it("temporada: diciembre", () => {
    expect(isWrappedSeason("2026-12-01")).toBe(true);
    expect(isWrappedSeason("2026-11-30")).toBe(false);
  });
});
