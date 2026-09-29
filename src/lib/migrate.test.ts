import { planMigration, planSize } from "./migrate";
import type { ProgressDoc } from "./progressStore";

const p = (status: ProgressDoc["status"], updatedAt: string): ProgressDoc => ({ status, rewatchCount: 0, updatedAt });

describe("planMigration", () => {
  it("sube lo que no existe en la nube", () => {
    const plan = planMigration(
      { progress: { a: p("watched", "2026-01-01T00:00:00Z") }, franchiseState: { marvel: { lastOrderId: "release", updatedAt: "2026-01-01T00:00:00Z" } } },
      { progress: {}, franchiseState: {} },
    );
    expect(plan.progress.map(([id]) => id)).toEqual(["a"]);
    expect(plan.franchiseState.map(([id]) => id)).toEqual(["marvel"]);
    expect(planSize(plan)).toBe(2);
  });

  it("gana el cambio más reciente por documento", () => {
    const plan = planMigration(
      {
        progress: {
          newer: p("watched", "2026-03-01T00:00:00Z"),
          older: p("planned", "2026-01-01T00:00:00Z"),
        },
        franchiseState: {},
      },
      {
        progress: {
          newer: p("planned", "2026-02-01T00:00:00Z"),
          older: p("watched", "2026-02-01T00:00:00Z"),
        },
        franchiseState: {},
      },
    );
    expect(plan.progress).toEqual([["newer", p("watched", "2026-03-01T00:00:00Z")]]);
  });

  it("no hay nada que migrar si el invitado está vacío", () => {
    expect(planSize(planMigration({ progress: {}, franchiseState: {} }, { progress: { a: p("watched", "x") }, franchiseState: {} }))).toBe(0);
  });
});
