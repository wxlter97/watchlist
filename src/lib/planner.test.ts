import { buildIndex } from "./catalogIndex";
import { buildIcs, fold, googleCalendarLink, icsDateTime, planEvents } from "./ics";
import {
  addDays,
  buildSchedule,
  groupUnits,
  pendingUnits,
  suggestForBudget,
  weekdayOf,
  ESTIMATED_MOVIE_MIN,
  type PlanUnit,
} from "./planner";
import { computePlan, goalTitles } from "./plans";
import type { ProgressDoc } from "./progressStore";
import { makeCatalog, title } from "../test/fixtures";

const watched = (extra: Partial<ProgressDoc> = {}): ProgressDoc => ({
  status: "watched",
  rewatchCount: 0,
  updatedAt: "2026-01-01T00:00:00Z",
  ...extra,
});

const movie = (id: string, runtimeMin: number, releaseDate = "2020-01-01") => title(id, releaseDate, { runtimeMin });
const series = title("show-2021", "2021-01-01", {
  tmdbType: "tv",
  kind: "series",
  runtimeMin: 300, // 6 episodios de 50
  seasons: [
    { number: 1, episodes: 4 },
    { number: 2, episodes: 2 },
  ],
});

describe("fechas", () => {
  it("día de la semana y suma de días sin depender de la zona horaria", () => {
    expect(weekdayOf("2026-09-28")).toBe("mon");
    expect(weekdayOf("2026-10-04")).toBe("sun");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("pendingUnits", () => {
  it("salta lo visto, divide series en episodios y usa la versión elegida", () => {
    const cut = movie("cut-2021", 120);
    cut.versions = [
      { id: "theatrical", name: "Cine", runtimeMin: 120, default: true },
      { id: "snyder", name: "Snyder", runtimeMin: 242 },
    ];
    const units = pendingUnits([movie("a", 100), cut, series], {
      a: watched(),
      "cut-2021": { status: "planned", rewatchCount: 0, versionId: "snyder", updatedAt: "" },
      "show-2021": { status: "watching", rewatchCount: 0, episodes: { 1: [1, 2] }, updatedAt: "" },
    });
    expect(units.map((u) => [u.titleId, u.minutes, u.season, u.episode])).toEqual([
      ["cut-2021", 242, undefined, undefined],
      ["show-2021", 50, 1, 3],
      ["show-2021", 50, 1, 4],
      ["show-2021", 50, 2, 1],
      ["show-2021", 50, 2, 2],
    ]);
  });

  it("supone una duración para lo que aún no tiene datos y lo marca", () => {
    const [unit] = pendingUnits([title("future-2030", "2030-01-01")], {});
    expect(unit).toMatchObject({ minutes: ESTIMATED_MOVIE_MIN, estimated: true });
  });

  it("un título repetido en la meta se agenda una sola vez", () => {
    const m = movie("m", 90);
    expect(pendingUnits([m, m], {})).toHaveLength(1);
  });
});

describe("groupUnits", () => {
  it("junta episodios consecutivos de la misma temporada", () => {
    const units = pendingUnits([series], {});
    expect(groupUnits(units)).toEqual([
      { titleId: "show-2021", minutes: 200, season: 1, from: 1, to: 4 },
      { titleId: "show-2021", minutes: 100, season: 2, from: 1, to: 2 },
    ]);
  });
});

describe("buildSchedule", () => {
  // 2026-09-28 es lunes.
  const base = { startDate: "2026-09-28", availableDays: ["fri", "sat"] as const, weeklyHours: 4 };

  it("reparte en los días disponibles con el presupuesto diario", () => {
    const units = pendingUnits([movie("a", 110), movie("b", 100), series], {});
    const s = buildSchedule(units, { ...base, availableDays: ["fri", "sat"] });
    expect(s.dailyMinutes).toBe(120);
    expect(s.days.map((d) => [d.date, d.items.map((i) => `${i.titleId}${i.from ? `:${i.season}.${i.from}-${i.to}` : ""}`)])).toEqual([
      ["2026-10-02", ["a"]],
      ["2026-10-03", ["b"]],
      ["2026-10-09", ["show-2021:1.1-2"]],
      ["2026-10-10", ["show-2021:1.3-4"]],
      ["2026-10-16", ["show-2021:2.1-2"]],
    ]);
    expect(s.endDate).toBe("2026-10-16");
    expect(s.complete).toBe(true);
    expect(s.fitsDeadline).toBeNull();
  });

  it("una película más larga que el presupuesto ocupa un día sola y descuenta de los siguientes", () => {
    const s = buildSchedule(pendingUnits([movie("long", 242), movie("short", 60)], {}), { ...base, availableDays: ["fri", "sat"] });
    // 120 min por día: el viernes se pasa 122, el sábado queda en -2 y se salta.
    expect(s.days.map((d) => [d.date, d.items.map((i) => i.titleId)])).toEqual([
      ["2026-10-02", ["long"]],
      ["2026-10-09", ["short"]],
    ]);
  });

  it("en promedio respeta las horas por semana aunque cada título sea más largo que un día", () => {
    const units = pendingUnits([movie("a", 180), movie("b", 180), movie("c", 180), movie("d", 180)], {});
    const s = buildSchedule(units, { ...base, availableDays: ["fri", "sat", "sun"], weeklyHours: 3 });
    // 3 h por semana, 3 h por título: uno por semana.
    expect(s.days.map((d) => d.date)).toEqual(["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23"]);
  });

  it("nunca agenda algo antes de su estreno", () => {
    const units = pendingUnits([movie("a", 60), movie("future", 90, "2026-10-08")], {});
    const s = buildSchedule(units, { ...base, availableDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], weeklyHours: 14 });
    expect(s.days.map((d) => d.date)).toEqual(["2026-09-28", "2026-10-08"]);
  });

  it("dice si alcanza para la fecha límite", () => {
    const units = pendingUnits([movie("a", 120), movie("b", 120), movie("c", 120)], {});
    const opts = { ...base, availableDays: ["sat"] as ("sat")[], weeklyHours: 2 };
    expect(buildSchedule(units, { ...opts, deadline: "2026-10-17" }).fitsDeadline).toBe(true);
    expect(buildSchedule(units, { ...opts, deadline: "2026-10-16" }).fitsDeadline).toBe(false);
  });

  it("sin días disponibles no agenda nada ni dice que alcanza", () => {
    const s = buildSchedule(pendingUnits([movie("a", 90)], {}), { ...base, availableDays: [], deadline: "2027-01-01" });
    expect(s.days).toEqual([]);
    expect(s.complete).toBe(false);
    expect(s.fitsDeadline).toBe(false);
  });
});

describe("suggestForBudget (Tengo X horas)", () => {
  const units: PlanUnit[] = pendingUnits([movie("a", 100), series, movie("b", 130)], {});

  it("toma en orden lo que cabe, con episodios sueltos, y dice qué sigue", () => {
    const s = suggestForBudget(units, 240, "2026-09-28");
    expect(s.items).toEqual([
      { titleId: "a", minutes: 100 },
      { titleId: "show-2021", minutes: 100, season: 1, from: 1, to: 2 },
    ]);
    expect(s.minutes).toBe(200);
    expect(s.next).toEqual({ titleId: "show-2021", minutes: 50, season: 1, from: 3, to: 3 });
  });

  it("no se salta una película que no cabe", () => {
    const s = suggestForBudget(pendingUnits([movie("long", 180), movie("short", 60)], {}), 120, "2026-09-28");
    expect(s.items).toEqual([]);
    expect(s.next?.titleId).toBe("long");
  });

  it("ignora lo que aún no se estrena", () => {
    const s = suggestForBudget(pendingUnits([movie("future", 90, "2027-01-01")], {}), 600, "2026-09-28");
    expect(s).toEqual({ items: [], minutes: 0 });
  });
});

describe("planes", () => {
  const catalog = makeCatalog();
  for (const t of catalog.titles) t.runtimeMin = 120;
  const franchise = catalog.franchises[0]!;
  franchise.entries.find((e) => e.titleId === "c-2005")!.importance = "essential";
  franchise.routes.push({ id: "r", name: "R", description: "", kind: "theme", titleIds: ["c-2005", "b-2003"] });
  const index = buildIndex(catalog);
  const ctx = { index, franchiseState: {}, progress: {} };

  it("la meta sale del orden, del orden activo o de la ruta", () => {
    const ids = (goal: Parameters<typeof goalTitles>[0], state = {}) =>
      goalTitles(goal, { index, franchiseState: state }).map((t) => t.id);
    expect(ids({ type: "order", franchiseId: "test", refId: "chrono" })).toEqual(["b-2003", "a-2001", "c-2005", "alt-2004"]);
    expect(ids({ type: "route", franchiseId: "test", refId: "r" })).toEqual(["c-2005", "b-2003"]);
    expect(
      ids({ type: "franchise", franchiseId: "test", refId: "test" }, { test: { lastOrderId: "curated", updatedAt: "" } }),
    ).toEqual(["c-2005", "a-2001"]);
  });

  it("si no alcanza, propone solo los esenciales", () => {
    const plan = {
      goal: { type: "order" as const, franchiseId: "test", refId: "release" },
      startDate: "2026-09-28",
      deadline: "2026-10-04",
      weeklyHours: 2,
      availableDays: ["sat" as const],
    };
    const view = computePlan(plan, ctx, "2026-09-28");
    expect(view.schedule.fitsDeadline).toBe(false);
    expect(view.essential?.fitsDeadline).toBe(true);
    expect(view.essential?.days.flatMap((d) => d.items.map((i) => i.titleId))).toEqual(["c-2005"]);
  });

  it("se recalcula desde hoy y con lo ya visto", () => {
    const plan = {
      goal: { type: "route" as const, franchiseId: "test", refId: "r" },
      startDate: "2026-09-01",
      weeklyHours: 14,
      availableDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const,
    };
    const view = computePlan({ ...plan, availableDays: [...plan.availableDays] }, { ...ctx, progress: { "c-2005": watched() } }, "2026-09-28");
    expect(view.pendingTitles).toBe(1);
    expect(view.schedule.days).toEqual([{ date: "2026-09-28", items: [{ titleId: "b-2003", minutes: 120 }] }]);
  });
});

describe("iCalendar", () => {
  it("hora flotante que cruza la medianoche", () => {
    expect(icsDateTime("2026-12-31", "23:00", 90)).toBe("20270101T003000");
  });

  it("corta líneas largas en 75 octetos sin romper caracteres", () => {
    const folded = fold(`SUMMARY:${"á".repeat(60)}`);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"á".repeat(60)}`);
  });

  it("arma un evento por día con UID estable y texto escapado", () => {
    const events = planEvents(
      { id: "p1", startTime: "20:00", lang: "es" },
      [{ date: "2026-10-02", items: [{ titleId: "a", minutes: 100 }, { titleId: "show", minutes: 100, season: 1, from: 1, to: 2 }] }],
      (id) => (id === "a" ? "Uno, dos; tres" : "Loki"),
    );
    expect(events[0]).toMatchObject({ uid: "p1-2026-10-02@watch-order", minutes: 200, summary: "Uno, dos; tres + Loki T1 E1–2" });
    const ics = buildIcs("Maratón", events, new Date("2026-09-28T12:00:00Z"));
    expect(ics).toContain("DTSTART:20261002T200000\r\n");
    expect(ics).toContain("DTEND:20261002T232000\r\n");
    expect(ics).toContain("SUMMARY:Uno\\, dos\\; tres + Loki T1 E1–2\r\n");
    expect(ics).toContain("DTSTAMP:20260928T120000Z\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("enlace de Google Calendar con el mismo horario", () => {
    const url = new URL(googleCalendarLink({ uid: "x", date: "2026-10-02", startTime: "20:00", minutes: 60, summary: "Loki" }));
    expect(url.searchParams.get("dates")).toBe("20261002T200000/20261002T210000");
    expect(url.searchParams.get("text")).toBe("Loki");
  });
});

describe("sameSchedule", () => {
  it("ignora el orden de las claves", async () => {
    const { sameSchedule } = await import("./plans");
    const a = [{ date: "2026-10-02", items: [{ titleId: "x", minutes: 50, season: 1, from: 1, to: 2 }] }];
    const b = [{ date: "2026-10-02", items: [{ from: 1, minutes: 50, season: 1, titleId: "x", to: 2 }] }];
    expect(sameSchedule(a, b)).toBe(true);
    expect(sameSchedule(a, [{ ...a[0]!, date: "2026-10-03" }])).toBe(false);
  });
});
