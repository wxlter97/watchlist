import type { ProgressDoc } from "./progressStore";

// Rachas (SPEC §9.4): días consecutivos con al menos un título o episodio marcado.

/** Fecha local YYYY-MM-DD de un instante ISO. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Días con actividad: cuándo se terminó un título, o se marcó un episodio de algo en curso. */
export function activityDays(progress: Record<string, ProgressDoc>): Set<string> {
  const days = new Set<string>();
  for (const doc of Object.values(progress)) {
    if (doc.status === "watched" && doc.watchedAt) days.add(localDay(doc.watchedAt));
    else if (doc.episodes && Object.keys(doc.episodes).length) days.add(localDay(doc.updatedAt));
  }
  return days;
}

const shift = (day: string, delta: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

export interface Streak {
  /** Racha vigente: sigue viva si la última actividad fue hoy o ayer. */
  current: number;
  best: number;
}

export function computeStreak(days: ReadonlySet<string>, today: string): Streak {
  let best = 0;
  for (const day of days) {
    if (days.has(shift(day, -1))) continue; // solo se cuenta desde el inicio de cada racha
    let length = 1;
    while (days.has(shift(day, length))) length++;
    best = Math.max(best, length);
  }
  const start = days.has(today) ? today : days.has(shift(today, -1)) ? shift(today, -1) : null;
  let current = 0;
  if (start) while (days.has(shift(start, -current))) current++;
  return { current, best };
}
