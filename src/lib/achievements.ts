import type { CatalogIndex } from "./catalogIndex";
import { minutesWatched } from "./episodes";
import { effectiveHidden } from "./filters";
import { computeOrder, resolveOrder } from "./orders";
import type { ProgressDoc } from "./progressStore";
import { activityDays, computeStreak } from "./streaks";
import type { Achievement, AchievementRule, Entry, Title } from "./types";
import { parseUnitKey, unitKey, unitReleaseDate, watchedPredicate } from "./units";

// Logros (SPEC §9.4): evaluación pura a partir del progreso. Solo se guarda la fecha en que
// se desbloquea cada uno; una vez desbloqueado no se pierde aunque se desmarque algo.

export interface AchievementContext {
  index: CatalogIndex;
  progress: Readonly<Record<string, ProgressDoc>>;
  today: string;
}

export interface AchievementStatus {
  achievement: Achievement;
  done: boolean;
  /** Avance hacia la meta (títulos, horas, días…), para los que faltan. */
  current: number;
  target: number;
}

interface Metrics {
  titles: number;
  hours: number;
  franchises: number;
  bestStreak: number;
}

function metrics({ index, progress, today }: AchievementContext): Metrics {
  let titles = 0;
  let minutes = 0;
  for (const [id, doc] of Object.entries(progress)) {
    const title = index.titlesById.get(id);
    if (!title) continue;
    if (doc.status === "watched") titles++;
    minutes += minutesWatched(title, doc);
  }
  let franchises = 0;
  for (const f of index.franchisesById.values()) {
    if (f.entries.some((e) => progress[e.titleId]?.status === "watched")) franchises++;
  }
  return { titles, hours: Math.floor(minutes / 60), franchises, bestStreak: computeStreak(activityDays({ ...progress }), today).best };
}

/** Una unidad que exige una regla: un título o una temporada (ver units.ts). */
export interface RuleUnit {
  title: Title;
  season?: number;
}

/** Unidades que exige una regla de completar (sin repetir, solo las ya estrenadas). */
export function ruleTitles(rule: AchievementRule, { index, today }: Pick<AchievementContext, "index" | "today">): RuleUnit[] {
  const franchise = "franchiseId" in rule ? index.franchisesById.get(rule.franchiseId) : undefined;
  if (!franchise) return [];
  const byIds = (keys: string[]) => {
    const out: RuleUnit[] = [];
    for (const key of new Set(keys)) {
      const { titleId, season } = parseUnitKey(key);
      const title = index.titlesById.get(titleId);
      if (title && unitReleaseDate(title, season) <= today) out.push({ title, season });
    }
    return out;
  };
  const entryKeys = (entries: Entry[]) => entries.map((e) => unitKey(e.titleId, e.season));

  switch (rule.type) {
    case "complete-group":
      return byIds(entryKeys(franchise.entries.filter((e) => e.group === rule.group)));
    case "complete-franchise": {
      const visible = new Set(
        franchise.continuities.filter((c) => (rule.continuityId ? c.id === rule.continuityId : !c.hiddenByDefault)).map((c) => c.id),
      );
      return byIds(entryKeys(franchise.entries.filter((e) => visible.has(e.continuityId))));
    }
    case "complete-route":
      return byIds(franchise.routes.find((r) => r.id === rule.routeId)?.titleIds ?? []);
    case "watched-in-order": {
      const order = resolveOrder(franchise, rule.orderId);
      if (order.id !== rule.orderId) return [];
      // Un orden curado vale tal cual; uno calculado, con las continuidades visibles por defecto.
      const hiddenContinuities = order.type === "curated" ? [] : effectiveHidden(franchise, undefined, undefined);
      return byIds(computeOrder(franchise, order, index.titlesById, { hiddenContinuities }).map((i) => i.key));
    }
    default:
      return [];
  }
}

/**
 * Todo visto y en esa secuencia: cada título se terminó después (o a la vez) que el anterior.
 * Las temporadas no tienen fecha propia: la secuencia se mira con títulos enteros.
 */
function watchedInSequence(units: RuleUnit[], progress: AchievementContext["progress"]): boolean {
  let last = "";
  for (const { title, season } of units) {
    if (season !== undefined) continue;
    const at = progress[title.id]?.watchedAt;
    if (progress[title.id]?.status !== "watched" || !at || at < last) return false;
    last = at;
  }
  return true;
}

export function evaluateAchievements(achievements: readonly Achievement[], ctx: AchievementContext): AchievementStatus[] {
  const m = metrics(ctx);
  return achievements.map((achievement) => {
    const rule = achievement.rule;
    switch (rule.type) {
      case "count": {
        const current = m[rule.metric];
        return { achievement, done: current >= rule.value, current: Math.min(current, rule.value), target: rule.value };
      }
      case "streak":
        return { achievement, done: m.bestStreak >= rule.days, current: Math.min(m.bestStreak, rule.days), target: rule.days };
      default: {
        const titles = ruleTitles(rule, ctx);
        const isWatched = watchedPredicate(ctx.progress, ctx.index.titlesById);
        const current = titles.filter((u) => isWatched(u.title.id, u.season)).length;
        const complete = titles.length > 0 && current === titles.length;
        const done = rule.type === "watched-in-order" ? complete && watchedInSequence(titles, ctx.progress) : complete;
        return { achievement, done, current, target: titles.length };
      }
    }
  });
}

/** Los que se cumplen ahora y todavía no estaban desbloqueados. */
export function newlyUnlocked(statuses: readonly AchievementStatus[], unlocked: Readonly<Record<string, unknown>>): string[] {
  return statuses.filter((s) => s.done && !(s.achievement.id in unlocked)).map((s) => s.achievement.id);
}
