import type { Lang } from "./types";

// Qué avisar y con qué texto (SPEC §9.6). Lógica pura: la usan los crons de /api/cron y el
// script de catálogo, con los datos que ellos leen.

export interface CatalogTitleLite {
  id: string;
  title: string;
  releaseDate: string;
  localized?: Partial<Record<Lang, { title: string }>>;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const DAY = 86_400_000;
export const addDaysIso = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

export interface DueRelease {
  titleId: string;
  franchiseId: string;
  /** 0 = hoy, 7 = en una semana. */
  inDays: 0 | 7;
}

/** Estrenos de las franquicias seguidas: hoy y dentro de 7 días. Un título, una vez. */
export function releasesDue(
  followed: readonly string[],
  franchises: ReadonlyMap<string, { entries: { titleId: string }[] }>,
  titles: ReadonlyMap<string, CatalogTitleLite>,
  today: string,
): DueRelease[] {
  const inWeek = addDaysIso(today, 7);
  const seen = new Set<string>();
  const due: DueRelease[] = [];
  for (const franchiseId of followed) {
    for (const { titleId } of franchises.get(franchiseId)?.entries ?? []) {
      const t = titles.get(titleId);
      if (!t || seen.has(t.id)) continue;
      const inDays = t.releaseDate === today ? 0 : t.releaseDate === inWeek ? 7 : null;
      if (inDays === null) continue;
      seen.add(t.id);
      due.push({ titleId: t.id, franchiseId, inDays });
    }
  }
  return due.sort((a, b) => a.inDays - b.inDays || a.titleId.localeCompare(b.titleId));
}

/** Proveedores de suscripción que aparecieron (antes no estaba en ninguno de la región). */
export function newlyStreaming(previous: readonly number[] | undefined, current: readonly number[]): boolean {
  return previous !== undefined && previous.length === 0 && current.length > 0;
}

const name = (t: CatalogTitleLite, lang: Lang) => t.localized?.[lang]?.title ?? t.title;

const list = (names: string[], lang: Lang) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} ${lang === "es" ? "y" : "and"} ${names.at(-1)}`;

export function releasesMessage(due: DueRelease[], titles: ReadonlyMap<string, CatalogTitleLite>, lang: Lang, today: string): PushMessage | null {
  if (!due.length) return null;
  const todayNames = due.filter((d) => d.inDays === 0).map((d) => name(titles.get(d.titleId)!, lang));
  const weekNames = due.filter((d) => d.inDays === 7).map((d) => name(titles.get(d.titleId)!, lang));
  const parts: string[] = [];
  if (todayNames.length) parts.push(lang === "es" ? `Hoy se estrena ${list(todayNames, lang)}.` : `${list(todayNames, lang)} ${todayNames.length > 1 ? "are" : "is"} out today.`);
  if (weekNames.length) parts.push(lang === "es" ? `En una semana: ${list(weekNames, lang)}.` : `In one week: ${list(weekNames, lang)}.`);
  const single = due.length === 1 ? due[0]! : null;
  return {
    title: lang === "es" ? "Estrenos de tus franquicias" : "Releases from your franchises",
    body: parts.join(" "),
    url: single ? `/t/${single.titleId}` : "/",
    tag: `releases-${today}`,
  };
}

export function streamingMessage(titleIds: string[], titles: ReadonlyMap<string, CatalogTitleLite>, lang: Lang, today: string): PushMessage | null {
  const names = titleIds.flatMap((id) => (titles.has(id) ? [name(titles.get(id)!, lang)] : []));
  if (!names.length) return null;
  return {
    title: lang === "es" ? "Ya puedes verlo en streaming" : "Now streaming",
    body:
      lang === "es"
        ? `${list(names, lang)} ${names.length > 1 ? "llegaron" : "llegó"} a un servicio de tu región.`
        : `${list(names, lang)} ${names.length > 1 ? "are" : "is"} now on a streaming service in your region.`,
    url: titleIds.length === 1 ? `/t/${titleIds[0]}` : "/",
    tag: `streaming-${today}`,
  };
}

export function catalogMessage(newTitles: CatalogTitleLite[], newFranchises: { name: string }[], lang: Lang): PushMessage | null {
  const names = [...newFranchises.map((f) => f.name), ...newTitles.slice(0, 3).map((t) => name(t, lang))];
  if (!names.length) return null;
  const more = newTitles.length > 3 ? (lang === "es" ? ` y ${newTitles.length - 3} más` : ` and ${newTitles.length - 3} more`) : "";
  return {
    title: lang === "es" ? "Novedades en el catálogo" : "New in the catalog",
    body: `${names.join(", ")}${more}.`,
    url: newTitles.length === 1 && !newFranchises.length ? `/t/${newTitles[0]!.id}` : "/",
    tag: "catalog",
  };
}
