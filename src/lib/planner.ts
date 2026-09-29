import { totalEpisodes } from "./episodes";
import type { ProgressDoc } from "./progressStore";
import type { Title } from "./types";

// Planificador de maratón y "Tengo X horas" (SPEC §9.2). Lógica pura: recibe títulos en
// orden y el progreso, y reparte lo pendiente en días o en un bloque de tiempo.

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Duración supuesta cuando TMDB aún no la tiene (títulos por estrenar). */
export const ESTIMATED_MOVIE_MIN = 120;
export const ESTIMATED_EPISODE_MIN = 45;

/** Lo mínimo que se agenda: una película completa o un episodio. */
export interface PlanUnit {
  titleId: string;
  minutes: number;
  releaseDate: string;
  season?: number;
  episode?: number;
  estimated?: boolean;
}

/** Una sesión: un título completo o un rango de episodios de una temporada. */
export interface PlanItem {
  titleId: string;
  minutes: number;
  season?: number;
  from?: number;
  to?: number;
  estimated?: boolean;
}

export interface PlanDay {
  date: string;
  items: PlanItem[];
}

/** Duración de la versión elegida (o la default) de un título. */
export function runtimeOf(title: Title, doc?: ProgressDoc): number | undefined {
  return (
    title.versions?.find((v) => v.id === doc?.versionId)?.runtimeMin ??
    title.versions?.find((v) => v.default)?.runtimeMin ??
    title.runtimeMin
  );
}

/** Lo que falta ver de cada título, en orden: películas completas o episodios sueltos. */
export function pendingUnits(titles: readonly Title[], progress: Readonly<Record<string, ProgressDoc>>): PlanUnit[] {
  const units: PlanUnit[] = [];
  const seen = new Set<string>();
  for (const title of titles) {
    if (seen.has(title.id)) continue;
    seen.add(title.id);
    const doc = progress[title.id];
    if (doc?.status === "watched") continue;
    const runtime = runtimeOf(title, doc);
    const episodes = totalEpisodes(title);

    if (title.tmdbType === "tv" && episodes > 0) {
      const perEpisode = runtime ? Math.max(1, Math.round(runtime / episodes)) : ESTIMATED_EPISODE_MIN;
      for (const s of title.seasons ?? []) {
        const done = new Set(doc?.episodes?.[s.number] ?? []);
        for (let e = 1; e <= s.episodes; e++) {
          if (done.has(e)) continue;
          units.push({
            titleId: title.id,
            minutes: perEpisode,
            releaseDate: title.releaseDate,
            season: s.number,
            episode: e,
            ...(runtime ? {} : { estimated: true }),
          });
        }
      }
      continue;
    }

    units.push({
      titleId: title.id,
      minutes: runtime ?? (title.tmdbType === "tv" ? ESTIMATED_EPISODE_MIN : ESTIMATED_MOVIE_MIN),
      releaseDate: title.releaseDate,
      ...(runtime ? {} : { estimated: true }),
    });
  }
  return units;
}

/** Junta episodios consecutivos de la misma temporada en una sola sesión. */
export function groupUnits(units: readonly PlanUnit[]): PlanItem[] {
  const items: PlanItem[] = [];
  for (const u of units) {
    const last = items.at(-1);
    if (
      last &&
      u.episode !== undefined &&
      last.titleId === u.titleId &&
      last.season === u.season &&
      last.to !== undefined &&
      last.to + 1 === u.episode
    ) {
      last.to = u.episode;
      last.minutes += u.minutes;
      if (u.estimated) last.estimated = true;
      continue;
    }
    items.push({
      titleId: u.titleId,
      minutes: u.minutes,
      ...(u.episode !== undefined ? { season: u.season, from: u.episode, to: u.episode } : {}),
      ...(u.estimated ? { estimated: true } : {}),
    });
  }
  return items;
}

// ---- Fechas: siempre YYYY-MM-DD, con aritmética en UTC para no depender de la zona horaria ----

const DAY_MS = 86_400_000;
const parse = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const format = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  return format(parse(iso) + days * DAY_MS);
}

export function weekdayOf(iso: string): Weekday {
  // getUTCDay: 0 = domingo.
  return WEEKDAYS[(new Date(parse(iso)).getUTCDay() + 6) % 7]!;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

// ---- Planificador ----

export interface ScheduleOptions {
  startDate: string;
  availableDays: readonly Weekday[];
  weeklyHours: number;
  deadline?: string;
}

export interface Schedule {
  days: PlanDay[];
  totalMinutes: number;
  /** Último día con algo agendado. */
  endDate?: string;
  /** Todo quedó agendado (falso solo si no hay días disponibles). */
  complete: boolean;
  /** null sin fecha límite. */
  fitsDeadline: boolean | null;
  /** Unidades con duración supuesta (títulos sin datos de TMDB). */
  estimated: number;
  /** Minutos por día disponible. */
  dailyMinutes: number;
}

/** Tolerancia para no dejar un episodio corto para otro día por unos minutos. */
const SLACK = 1.1;
/** Tope de búsqueda: nunca más de 10 años de calendario. */
const MAX_DAYS = 3650;

/**
 * Reparte las unidades en los días disponibles, respetando el orden. Cada día admite
 * `weeklyHours / días` (con 10% de tolerancia). Una película más larga que eso ocupa un día
 * sola y lo que se pasa se descuenta de los días siguientes: en promedio nunca se agenda más
 * que las horas por semana. El tiempo que sobra un día no se acumula. Nada se agenda antes de
 * su estreno: el plan espera.
 */
export function buildSchedule(units: readonly PlanUnit[], options: ScheduleOptions): Schedule {
  const available = new Set(options.availableDays);
  const dailyMinutes = available.size ? Math.round((options.weeklyHours * 60) / available.size) : 0;
  const totalMinutes = units.reduce((n, u) => n + u.minutes, 0);
  const estimated = units.filter((u) => u.estimated).length;
  const days: PlanDay[] = [];
  let i = 0;
  // Minutos disponibles: negativo si un día anterior se pasó del presupuesto.
  let balance = 0;

  if (dailyMinutes > 0) {
    for (let offset = 0; i < units.length && offset < MAX_DAYS; offset++) {
      const date = addDays(options.startDate, offset);
      if (!available.has(weekdayOf(date))) continue;
      balance = Math.min(balance, 0) + dailyMinutes;
      if (balance <= 0) continue;
      const taken: PlanUnit[] = [];
      let used = 0;
      while (i < units.length) {
        const unit = units[i]!;
        if (unit.releaseDate > date) break;
        if (taken.length > 0 && used + unit.minutes > balance * SLACK) break;
        taken.push(unit);
        used += unit.minutes;
        i++;
        if (used >= balance) break;
      }
      balance -= used;
      if (taken.length) days.push({ date, items: groupUnits(taken) });
    }
  }

  const endDate = days.at(-1)?.date;
  const scheduledAll = i === units.length;
  return {
    days,
    totalMinutes,
    endDate,
    complete: scheduledAll,
    fitsDeadline: options.deadline ? scheduledAll && (!endDate || endDate <= options.deadline) : null,
    estimated,
    dailyMinutes,
  };
}

// ---- "Tengo X horas" ----

export interface BudgetSuggestion {
  items: PlanItem[];
  minutes: number;
  /** Lo siguiente en el orden, que ya no cupo. */
  next?: PlanItem;
}

/**
 * Los siguientes pendientes, en orden, que caben en `budgetMin`: películas completas o
 * N episodios. Se detiene en el primero que no cabe para no saltarse el orden.
 */
export function suggestForBudget(units: readonly PlanUnit[], budgetMin: number, today: string): BudgetSuggestion {
  const released = units.filter((u) => u.releaseDate <= today);
  const taken: PlanUnit[] = [];
  let minutes = 0;
  for (const unit of released) {
    if (minutes + unit.minutes > budgetMin) {
      return { items: groupUnits(taken), minutes, next: groupUnits([unit])[0] };
    }
    taken.push(unit);
    minutes += unit.minutes;
  }
  return { items: groupUnits(taken), minutes };
}
