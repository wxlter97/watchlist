import { REMINDER_WAITS_DAYS, shouldRemind } from "./install";

const DAY = 86_400_000;

describe("recordatorio de instalar la app", () => {
  it("avisa la primera vez", () => {
    expect(shouldRemind(undefined, Date.now())).toBe(true);
  });

  it("espera tras cerrarlo y vuelve después, cada vez más espaciado", () => {
    const at = 1_000_000_000_000;
    expect(shouldRemind({ dismissed: 1, at }, at + (REMINDER_WAITS_DAYS[0] - 1) * DAY)).toBe(false);
    expect(shouldRemind({ dismissed: 1, at }, at + REMINDER_WAITS_DAYS[0] * DAY)).toBe(true);
    expect(shouldRemind({ dismissed: 2, at }, at + (REMINDER_WAITS_DAYS[1] - 1) * DAY)).toBe(false);
    expect(shouldRemind({ dismissed: 2, at }, at + REMINDER_WAITS_DAYS[1] * DAY)).toBe(true);
  });

  it("después de cerrarlo tres veces no vuelve", () => {
    expect(shouldRemind({ dismissed: 3, at: 0 }, 365 * DAY)).toBe(false);
  });
});
