import type { CatalogIndex } from "./catalogIndex";
import { effectiveHidden } from "./filters";
import { computeOrder, resolveOrder } from "./orders";
import { buildSchedule, pendingUnits, type PlanDay, type Schedule, type Weekday } from "./planner";
import type { FranchiseStateDoc, ProgressDoc } from "./progressStore";
import { resolveRoute } from "./routes";
import type { Entry, Lang, Title } from "./types";

// Planes de maratón (SPEC §6 plans, §9.2). El calendario se recalcula siempre a partir de
// hoy y del progreso actual; `schedule` guarda la última versión para el feed .ics.

export type GoalType = "franchise" | "order" | "route";

export interface PlanGoal {
  type: GoalType;
  franchiseId: string;
  /** Id de la franquicia, del orden o de la ruta. */
  refId: string;
}

export interface PlanDoc {
  id: string;
  name: string;
  goal: PlanGoal;
  /** Solo los títulos esenciales de la meta (la propuesta cuando no alcanza el tiempo). */
  essentialOnly?: boolean;
  startDate: string;
  deadline?: string;
  weeklyHours: number;
  availableDays: Weekday[];
  /** Hora local de inicio de cada sesión en el calendario, "HH:MM". */
  startTime: string;
  schedule: PlanDay[];
  /** Idioma de los nombres en el feed. */
  lang: Lang;
  /** Secreto del feed suscribible; sin él la URL no existe. Se rota para revocarla. */
  feedToken?: string;
  calendarExported: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalContext {
  index: CatalogIndex;
  franchiseState: Readonly<Record<string, FranchiseStateDoc>>;
}

/** Una unidad de la meta: título o temporada, con su entry para filtrar esenciales. */
export interface GoalItem {
  title: Title;
  season?: number;
  entry?: Entry;
}

/** Títulos (o temporadas) de la meta, en orden. */
export function goalUnits(goal: PlanGoal, { index, franchiseState }: GoalContext, essentialOnly = false): GoalItem[] {
  const franchise = index.franchisesById.get(goal.franchiseId);
  if (!franchise) return [];
  const state = franchiseState[franchise.id];

  let titles: GoalItem[];
  if (goal.type === "route") {
    const route = franchise.routes.find((r) => r.id === goal.refId);
    titles = route ? resolveRoute(route, franchise, index).map(({ title, season, entry }) => ({ title, season, entry })) : [];
  } else {
    // Franquicia: el orden activo del perfil. Orden: uno concreto. Ambos con las continuidades visibles.
    const orderId = goal.type === "order" ? goal.refId : state?.lastOrderId;
    const order = resolveOrder(franchise, orderId, state?.customOrder);
    const hiddenContinuities = effectiveHidden(franchise, state?.hiddenContinuities, state?.shownContinuities);
    titles = computeOrder(franchise, order, index.titlesById, { hiddenContinuities }).map(({ title, season, entry }) => ({ title, season, entry }));
  }

  if (!essentialOnly) return titles;
  return titles.filter((u) => u.entry?.importance === "essential");
}

export interface PlanView {
  schedule: Schedule;
  /** Cuántos títulos de la meta quedan pendientes. */
  pendingTitles: number;
  totalTitles: number;
  /** Alternativa con solo los esenciales, cuando no alcanza para la fecha límite. */
  essential?: Schedule;
}

export function computePlan(
  plan: Pick<PlanDoc, "goal" | "essentialOnly" | "startDate" | "deadline" | "weeklyHours" | "availableDays">,
  ctx: GoalContext & { progress: Readonly<Record<string, ProgressDoc>> },
  today: string,
): PlanView {
  const options = {
    startDate: plan.startDate > today ? plan.startDate : today,
    availableDays: plan.availableDays,
    weeklyHours: plan.weeklyHours,
    deadline: plan.deadline,
  };
  const titles = goalUnits(plan.goal, ctx, plan.essentialOnly);
  const units = pendingUnits(titles, ctx.progress);
  const schedule = buildSchedule(units, options);
  const pendingTitles = new Set(units.map((u) => u.titleId)).size;

  let essential: Schedule | undefined;
  if (schedule.fitsDeadline === false && !plan.essentialOnly) {
    const essentialTitles = goalUnits(plan.goal, ctx, true);
    if (essentialTitles.length > 0 && essentialTitles.length < titles.length) {
      essential = buildSchedule(pendingUnits(essentialTitles, ctx.progress), options);
    }
  }
  return { schedule, pendingTitles, totalTitles: titles.length, essential };
}

/** La meta todavía existe en el catálogo (una ruta u orden pudo cambiar de id). */
export function goalExists(goal: PlanGoal, index: CatalogIndex): boolean {
  const franchise = index.franchisesById.get(goal.franchiseId);
  if (!franchise) return false;
  if (goal.type === "route") return franchise.routes.some((r) => r.id === goal.refId);
  if (goal.type === "order") return franchise.orders.some((o) => o.id === goal.refId) || goal.refId === "custom";
  return goal.refId === franchise.id;
}

/** Secreto aleatorio para la URL del feed (256 bits en hex). */
export function newFeedToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara calendarios sin depender del orden de las claves (Firestore las devuelve ordenadas). */
export function sameSchedule(a: readonly PlanDay[], b: readonly PlanDay[]): boolean {
  const key = (days: readonly PlanDay[]) =>
    days
      .map((d) => `${d.date}:${d.items.map((i) => [i.titleId, i.minutes, i.season, i.from, i.to, i.estimated ? 1 : 0].join(",")).join("|")}`)
      .join(";");
  return key(a) === key(b);
}
