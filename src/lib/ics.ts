import type { PlanDay, PlanItem } from "./planner";
import type { Lang } from "./types";

// iCalendar (RFC 5545) para el planificador: el mismo código arma el archivo que se descarga
// y el feed suscribible de /api/calendar. Sin dependencias del navegador.

export interface CalendarEvent {
  uid: string;
  /** YYYY-MM-DD */
  date: string;
  /** "HH:MM", hora local flotante: el calendario la muestra en la zona del usuario. */
  startTime: string;
  minutes: number;
  summary: string;
  description?: string;
  url?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha y hora flotante (sin zona) en formato iCalendar, sumando minutos. */
export function icsDateTime(date: string, time: string, plusMinutes = 0): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m + plusMinutes));
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Corta líneas a 75 octetos (RFC 5545 §3.1) sin partir caracteres UTF-8. */
export function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // las continuaciones empiezan con un espacio
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(calendarName: string, events: readonly CalendarEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//wxlter//Watch Order//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${icsDateTime(e.date, e.startTime)}`,
      `DTEND:${icsDateTime(e.date, e.startTime, e.minutes)}`,
      `SUMMARY:${escapeText(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

const EPISODE_LABEL: Record<Lang, (s: number, from: number, to: number) => string> = {
  es: (s, from, to) => (from === to ? `T${s} E${from}` : `T${s} E${from}–${to}`),
  en: (s, from, to) => (from === to ? `S${s} E${from}` : `S${s} E${from}–${to}`),
};

/** "Loki T1 E1–3", "Iron Man". */
export function itemLabel(item: PlanItem, name: string, lang: Lang): string {
  return item.season !== undefined && item.from !== undefined
    ? `${name} ${EPISODE_LABEL[lang](item.season, item.from, item.to ?? item.from)}`
    : name;
}

/** Un evento por día del plan, con cada sesión en la descripción. */
export function planEvents(
  plan: { id: string; startTime: string; lang: Lang },
  days: readonly PlanDay[],
  nameOf: (titleId: string) => string,
  appUrl?: string,
): CalendarEvent[] {
  return days.map((day) => {
    const labels = day.items.map((item) => itemLabel(item, nameOf(item.titleId), plan.lang));
    return {
      uid: `${plan.id}-${day.date}@watch-order`,
      date: day.date,
      startTime: plan.startTime,
      minutes: day.items.reduce((n, i) => n + i.minutes, 0),
      summary: labels.join(" + "),
      description: labels.length > 1 ? labels.map((l) => `• ${l}`).join("\n") : undefined,
      url: appUrl ? `${appUrl}/plans/${plan.id}` : undefined,
    };
  });
}

/** Enlace para crear un evento en Google Calendar (sin OAuth). */
export function googleCalendarLink(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.summary,
    dates: `${icsDateTime(e.date, e.startTime)}/${icsDateTime(e.date, e.startTime, e.minutes)}`,
  });
  if (e.description) params.set("details", e.description);
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Suscribirse a un feed desde Google Calendar (necesita una URL pública). */
export function googleSubscribeLink(feedUrl: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl.replace(/^https?:/, "webcal:"))}`;
}
