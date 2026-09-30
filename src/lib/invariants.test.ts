import achievementsJson from "../data/achievements.json";
import { evaluateAchievements } from "./achievements";
import { catalog, catalogIndex } from "./catalogFull";
import { buildIndex } from "./catalogIndex";
import { computeOrder, resolveOrder } from "./orders";
import { summarize } from "./progress";
import { unitKey } from "./units";
import { addDays, buildSchedule, daysBetween, weekdayOf, WEEKDAYS, type PlanUnit, type Weekday } from "./planner";
import type { ProgressDoc } from "./progressStore";
import { computeStreak } from "./streaks";
import type { Achievement } from "./types";
import { entry, makeCatalog } from "../test/fixtures";

// Criterios de aceptación (SPEC §12) comprobados con datos aleatorios o con el catálogo real.

/** PRNG determinista (mulberry32): los fallos se pueden reproducir con la misma semilla. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: () => number, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
const shuffle = <T>(r: () => number, list: T[]) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(r, 0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

describe("planificador: nunca más horas por semana que las indicadas", () => {
  const SLACK = 1.1;

  for (let seed = 1; seed <= 60; seed++) {
    it(`semilla ${seed}`, () => {
      const r = rng(seed);
      const startDate = addDays("2026-01-05", int(r, 0, 30));
      const units: PlanUnit[] = Array.from({ length: int(r, 1, 40) }, (_, i) => ({
        titleId: `t${i}`,
        minutes: r() < 0.5 ? int(r, 20, 60) : int(r, 80, 240),
        releaseDate: r() < 0.15 ? addDays(startDate, int(r, 0, 120)) : "2000-01-01",
      }));
      const availableDays = WEEKDAYS.filter(() => r() < 0.5);
      if (!availableDays.length) availableDays.push(WEEKDAYS[int(r, 0, 6)]!);
      const weeklyHours = int(r, 1, 30);
      const schedule = buildSchedule(units, { startDate, availableDays, weeklyHours });

      // Todo queda agendado, una vez, en orden y nunca antes de su estreno.
      const flat = schedule.days.flatMap((d) => d.items.map((item) => ({ date: d.date, ...item })));
      expect(flat.map((i) => i.titleId)).toEqual(units.map((u) => u.titleId));
      expect(schedule.complete).toBe(true);
      const byId = new Map(units.map((u) => [u.titleId, u]));
      for (const item of flat) expect(item.date >= byId.get(item.titleId)!.releaseDate).toBe(true);

      // Solo días disponibles, desde la fecha de inicio.
      const allowed = new Set<Weekday>(availableDays);
      for (const day of schedule.days) {
        expect(allowed.has(weekdayOf(day.date))).toBe(true);
        expect(day.date >= startDate).toBe(true);
      }

      // En cualquier tramo desde el inicio, lo agendado cabe en las horas de ese tramo
      // (con la tolerancia del 10%) más, a lo sumo, un título que no entra en un día.
      const longest = Math.max(...units.map((u) => u.minutes));
      let used = 0;
      for (const day of schedule.days) {
        used += day.items.reduce((n, i) => n + i.minutes, 0);
        const weeks = (daysBetween(startDate, day.date) + 1) / 7;
        const budget = Math.ceil(weeks) * weeklyHours * 60;
        expect(used).toBeLessThanOrEqual(budget * SLACK + longest);
      }
    });
  }
});

describe("órdenes del catálogo real", () => {
  const pairs = catalog.franchises.flatMap((f) => f.orders.map((o) => [f, o] as const));

  it.each(pairs.map(([f, o]) => [`${f.id}/${o.id}`, f, o]))("%s", (_, franchise, order) => {
    const items = computeOrder(franchise, resolveOrder(franchise, order.id), catalogIndex.titlesById);
    const ids = items.map((i) => i.key);
    // Sin duplicados y con posiciones 1..n.
    expect(new Set(ids).size).toBe(ids.length);
    expect(items.map((i) => i.position)).toEqual(ids.map((_, i) => i + 1));
    const entries = franchise.entries.map((e) => unitKey(e.titleId, e.season));
    if (order.type === "curated") {
      for (const id of ids) expect(entries).toContain(id);
    } else {
      // Los órdenes que no son curados incluyen cada entry exactamente una vez.
      expect([...ids].sort()).toEqual([...entries].sort());
    }
  });

  it("ocultar continuidades nunca cambia la posición de lo que queda", () => {
    for (const franchise of catalog.franchises) {
      if (franchise.continuities.length < 2) continue;
      const hidden = franchise.continuities.slice(1).map((c) => c.id);
      for (const order of franchise.orders) {
        const resolved = resolveOrder(franchise, order.id);
        const all = new Map(computeOrder(franchise, resolved, catalogIndex.titlesById).map((i) => [i.key, i.position]));
        for (const item of computeOrder(franchise, resolved, catalogIndex.titlesById, { hiddenContinuities: hidden })) {
          // Los curados no se filtran por continuidad (ver computeOrder).
          if (resolved.type !== "curated") expect(hidden).not.toContain(item.entry.continuityId);
          expect(item.position).toBe(all.get(item.key));
        }
      }
    }
  });
});

describe("logros deterministas: mismo progreso, mismos logros", () => {
  const achievements = achievementsJson as Achievement[];
  const released = catalog.titles.filter((t) => t.releaseDate <= "2026-09-01");

  for (let seed = 1; seed <= 10; seed++) {
    it(`semilla ${seed}`, () => {
      const r = rng(seed);
      const progress: Record<string, ProgressDoc> = {};
      for (const t of shuffle(r, released).slice(0, int(r, 0, released.length))) {
        const at = new Date(Date.UTC(2025, 0, 1) + int(r, 0, 600) * 86_400_000).toISOString();
        progress[t.id] = { status: "watched", rewatchCount: int(r, 0, 2), watchedAt: at, updatedAt: at };
      }
      const shuffled = Object.fromEntries(shuffle(r, Object.entries(progress)));
      const ctx = { index: catalogIndex, today: "2026-09-29" };
      const a = evaluateAchievements(achievements, { ...ctx, progress });
      const b = evaluateAchievements(achievements, { ...ctx, progress: shuffled });
      expect(b).toEqual(a);
    });
  }
});

describe("computeStreak", () => {
  const days = (...list: string[]) => new Set(list);

  it("sin actividad no hay racha", () => {
    expect(computeStreak(days(), "2026-09-29")).toEqual({ current: 0, best: 0 });
  });

  it("la racha sigue viva si la última actividad fue hoy o ayer", () => {
    const set = days("2026-09-26", "2026-09-27", "2026-09-28");
    expect(computeStreak(set, "2026-09-28")).toEqual({ current: 3, best: 3 });
    expect(computeStreak(set, "2026-09-29")).toEqual({ current: 3, best: 3 });
    expect(computeStreak(set, "2026-09-30")).toEqual({ current: 0, best: 3 });
  });

  it("la mejor racha puede ser una pasada y cruza meses y años", () => {
    const set = days("2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-09-29");
    expect(computeStreak(set, "2026-09-29")).toEqual({ current: 1, best: 4 });
  });
});

describe("un título compartido entre franquicias se marca una vez", () => {
  it("aparece visto en todas las franquicias que lo incluyen", () => {
    const c = makeCatalog();
    const other = { ...structuredClone(c.franchises[0]!), id: "other", entries: [entry("b-2003")] };
    c.franchises.push(other);
    const index = buildIndex(c);
    expect(index.franchisesByTitle.get("b-2003")!.map((r) => r.franchise.id)).toEqual(["test", "other"]);
    const progress: Record<string, ProgressDoc> = { "b-2003": { status: "watched", rewatchCount: 0, updatedAt: "2026-01-01T00:00:00Z" } };
    const isWatched = (id: string) => progress[id]?.status === "watched";
    for (const f of c.franchises) {
      const items = computeOrder(f, resolveOrder(f, "release"), index.titlesById);
      expect(summarize(items, isWatched, "2030-01-01").watched).toBe(1);
    }
  });
});
