import type { Franchise, Title } from "./types";

export interface Upcoming<F = Franchise> {
  title: Title;
  franchise: F;
}

/**
 * Estrenos de las franquicias dadas entre hoy (incluido) y `days` días después, por fecha.
 * Funciona con el manifiesto (sin cargar las franquicias): basta con saber sus títulos.
 */
export function upcomingReleases<F extends { titles: readonly { titleId: string }[] }>(
  franchisesById: ReadonlyMap<string, F>,
  titlesById: ReadonlyMap<string, Title>,
  franchiseIds: readonly string[],
  today: string,
  days = 365,
): Upcoming<F>[] {
  const until = new Date(`${today}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + days);
  const limit = until.toISOString().slice(0, 10);

  const seen = new Set<string>();
  const out: Upcoming<F>[] = [];
  for (const id of franchiseIds) {
    const franchise = franchisesById.get(id);
    if (!franchise) continue;
    for (const { titleId } of franchise.titles) {
      const title = titlesById.get(titleId);
      if (!title || seen.has(title.id) || title.releaseDate < today || title.releaseDate > limit) continue;
      seen.add(title.id);
      out.push({ title, franchise });
    }
  }
  return out.sort((a, b) => a.title.releaseDate.localeCompare(b.title.releaseDate) || a.title.id.localeCompare(b.title.id));
}
