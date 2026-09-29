import { buildIndex } from "./catalogIndex";
import { computeStats } from "./stats";
import { activityDays, computeStreak } from "./streaks";
import { makeCatalog } from "../test/fixtures";
import type { ProgressDoc } from "./progressStore";

const w = (day: string, extra: Partial<ProgressDoc> = {}): ProgressDoc => ({
  status: "watched",
  rewatchCount: 0,
  watchedAt: `${day}T15:00:00`,
  updatedAt: `${day}T15:00:00`,
  ...extra,
});

describe("computeStreak", () => {
  const days = new Set(["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-26", "2026-09-27"]);

  it("calcula la mejor racha y la vigente", () => {
    expect(computeStreak(days, "2026-09-27")).toEqual({ current: 2, best: 3 });
  });

  it("la racha sigue viva si la última actividad fue ayer, y se corta si fue antes", () => {
    expect(computeStreak(days, "2026-09-28").current).toBe(2);
    expect(computeStreak(days, "2026-09-29").current).toBe(0);
  });

  it("sin actividad no hay racha", () => {
    expect(computeStreak(new Set(), "2026-09-28")).toEqual({ current: 0, best: 0 });
  });
});

describe("activityDays", () => {
  it("usa watchedAt para lo terminado y updatedAt para episodios en curso", () => {
    const days = activityDays({
      a: w("2026-09-01"),
      b: { status: "watching", rewatchCount: 0, updatedAt: "2026-09-02T10:00:00", episodes: { 1: [1] } },
      c: { status: "planned", rewatchCount: 0, updatedAt: "2026-09-03T10:00:00" },
    });
    expect([...days].sort()).toEqual(["2026-09-01", "2026-09-02"]);
  });
});

describe("computeStats", () => {
  const catalog = makeCatalog();
  catalog.titles[0]!.runtimeMin = 100; // a-2001
  catalog.titles[1]!.runtimeMin = 90; // b-2003
  const index = buildIndex(catalog);

  it("suma horas, títulos, calificaciones y progreso por franquicia", () => {
    const stats = computeStats(
      index,
      { "a-2001": w("2026-09-27", { rating: 4, rewatchCount: 1 }), "b-2003": w("2026-09-26", { rating: 5 }), ghost: w("2026-09-26") },
      "2026-09-27",
    );
    expect(stats.minutes).toBe(290);
    expect(stats.titlesWatched).toBe(2);
    expect(stats.averageRating).toBe(4.5);
    expect(stats.perFranchise[0]).toMatchObject({ minutes: 290, watched: 2, total: 4 });
    expect(stats.topFranchise?.franchise.id).toBe("test");
    expect(stats.streak).toEqual({ current: 2, best: 2 });
  });

  it("sin progreso no hay franquicia más vista ni promedio", () => {
    const stats = computeStats(index, {}, "2026-09-27");
    expect(stats.topFranchise).toBeNull();
    expect(stats.averageRating).toBeNull();
  });
});
