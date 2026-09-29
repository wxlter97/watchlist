import { ACHIEVEMENT_ICONS } from "./achievementIcons";
import { evaluateAchievements, newlyUnlocked } from "./achievements";
import { catalog as realCatalog } from "./catalog";
import { buildIndex } from "./catalogIndex";
import type { ProgressDoc } from "./progressStore";
import type { Achievement, AchievementRule } from "./types";
import { validateAchievements } from "./validateCatalog";
import { makeCatalog, title } from "../test/fixtures";
import achievementsJson from "../data/achievements.json";

const w = (at: string, extra: Partial<ProgressDoc> = {}): ProgressDoc => ({
  status: "watched",
  rewatchCount: 0,
  watchedAt: at,
  updatedAt: at,
  ...extra,
});
const ach = (id: string, rule: AchievementRule): Achievement => ({ id, name: id, description: "", icon: "star", rule });

const catalog = makeCatalog();
for (const t of catalog.titles) t.runtimeMin = 120;
catalog.titles.push(title("future-2030", "2030-01-01"));
const franchise = catalog.franchises[0]!;
franchise.entries.push({ titleId: "future-2030", continuityId: "main", importance: "optional", group: "g1" });
franchise.continuities[1]!.hiddenByDefault = true;
franchise.routes.push({ id: "r", name: "R", description: "", kind: "theme", titleIds: ["b-2003", "alt-2004"] });
const index = buildIndex(catalog);
const today = "2026-09-28";
const run = (list: Achievement[], progress: Record<string, ProgressDoc>) =>
  evaluateAchievements(list, { index, progress, today }).map((s) => [s.achievement.id, s.done, s.current, s.target]);

describe("evaluateAchievements", () => {
  it("conteos de títulos, horas y franquicias", () => {
    const progress = { "a-2001": w("2026-01-01T10:00:00Z"), "b-2003": w("2026-01-02T10:00:00Z", { rewatchCount: 1 }) };
    expect(
      run(
        [
          ach("t2", { type: "count", metric: "titles", value: 2 }),
          ach("t3", { type: "count", metric: "titles", value: 3 }),
          ach("h6", { type: "count", metric: "hours", value: 6 }),
          ach("f1", { type: "count", metric: "franchises", value: 1 }),
        ],
        progress,
      ),
    ).toEqual([
      ["t2", true, 2, 2],
      ["t3", false, 2, 3],
      ["h6", true, 6, 6], // el rewatch suma
      ["f1", true, 1, 1],
    ]);
  });

  it("completar un grupo ignora lo que aún no se estrena", () => {
    const rule: AchievementRule = { type: "complete-group", franchiseId: "test", group: "g1" };
    expect(run([ach("g1", rule)], { "a-2001": w("2026-01-01T00:00:00Z") })).toEqual([["g1", false, 1, 2]]);
    expect(run([ach("g1", rule)], { "a-2001": w("2026-01-01T00:00:00Z"), "c-2005": w("2026-01-02T00:00:00Z") })).toEqual([
      ["g1", true, 2, 2],
    ]);
  });

  it("completar una franquicia usa las continuidades visibles por defecto, o la indicada", () => {
    const all = { "a-2001": w("2026-01-01T00:00:00Z"), "b-2003": w("2026-01-01T00:00:00Z"), "c-2005": w("2026-01-01T00:00:00Z") };
    expect(
      run(
        [
          ach("main", { type: "complete-franchise", franchiseId: "test" }),
          ach("alt", { type: "complete-franchise", franchiseId: "test", continuityId: "alt" }),
        ],
        all,
      ),
    ).toEqual([
      ["main", true, 3, 3],
      ["alt", false, 0, 1],
    ]);
  });

  it("completar una ruta", () => {
    const rule: AchievementRule = { type: "complete-route", franchiseId: "test", routeId: "r" };
    expect(run([ach("r", rule)], { "b-2003": w("2026-01-01T00:00:00Z"), "alt-2004": w("2026-01-01T00:00:00Z") })).toEqual([
      ["r", true, 2, 2],
    ]);
  });

  it("visto en orden exige la secuencia de fechas", () => {
    const rule: AchievementRule = { type: "watched-in-order", franchiseId: "test", orderId: "curated" }; // c-2005, a-2001
    const inOrder = { "c-2005": w("2026-01-01T10:00:00Z"), "a-2001": w("2026-01-02T10:00:00Z") };
    const outOfOrder = { "c-2005": w("2026-01-03T10:00:00Z"), "a-2001": w("2026-01-02T10:00:00Z") };
    expect(run([ach("o", rule)], inOrder)).toEqual([["o", true, 2, 2]]);
    expect(run([ach("o", rule)], outOfOrder)).toEqual([["o", false, 2, 2]]);
  });

  it("rachas por la mejor racha, aunque ya se haya cortado", () => {
    const progress = {
      "a-2001": w("2026-03-01T12:00:00"),
      "b-2003": w("2026-03-02T12:00:00"),
      "c-2005": w("2026-03-03T12:00:00"),
    };
    expect(run([ach("s3", { type: "streak", days: 3 }), ach("s7", { type: "streak", days: 7 })], progress)).toEqual([
      ["s3", true, 3, 3],
      ["s7", false, 3, 7],
    ]);
  });

  it("una regla que apunta a algo inexistente nunca se cumple", () => {
    expect(run([ach("x", { type: "complete-route", franchiseId: "test", routeId: "nope" })], {})).toEqual([["x", false, 0, 0]]);
  });

  it("newlyUnlocked solo devuelve los nuevos", () => {
    const statuses = evaluateAchievements([ach("t1", { type: "count", metric: "titles", value: 1 })], {
      index,
      progress: { "a-2001": w("2026-01-01T00:00:00Z") },
      today,
    });
    expect(newlyUnlocked(statuses, {})).toEqual(["t1"]);
    expect(newlyUnlocked(statuses, { t1: { unlockedAt: "x" } })).toEqual([]);
  });
});

describe("achievements.json", () => {
  it("es válido contra el catálogo real", () => {
    expect(validateAchievements(achievementsJson as Achievement[], realCatalog, Object.keys(ACHIEVEMENT_ICONS))).toEqual([]);
  });

  it("todos los logros de completar tienen algo que completar hoy", () => {
    const statuses = evaluateAchievements(achievementsJson as Achievement[], { index: buildIndex(realCatalog), progress: {}, today });
    expect(statuses.filter((s) => s.target === 0).map((s) => s.achievement.id)).toEqual([]);
  });

  it("el validador detecta referencias rotas", () => {
    const text = { es: "x", en: "x" };
    const bad = [
      { ...ach("bad", { type: "complete-group", franchiseId: "marvel", group: "phase-99" }), name: text, description: text },
      { ...ach("x", { type: "streak", days: 0 }), icon: "nope", name: "solo un idioma", description: text },
    ];
    expect(validateAchievements(bad, realCatalog, Object.keys(ACHIEVEMENT_ICONS))).toEqual([
      'logro "bad": ningún título de marvel está en el grupo "phase-99"',
      'logro "x": ícono "nope" desconocido',
      'logro "x": name debe tener es y en',
      'logro "x": la meta debe ser un entero positivo',
    ]);
  });
});
