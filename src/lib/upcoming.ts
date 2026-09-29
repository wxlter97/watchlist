import type { CatalogIndex } from "./catalogIndex";
import type { Franchise, Title } from "./types";

export interface Upcoming {
  title: Title;
  franchise: Franchise;
}

/** Estrenos de las franquicias dadas entre hoy (incluido) y `days` días después, por fecha. */
export function upcomingReleases(
  index: CatalogIndex,
  franchiseIds: readonly string[],
  today: string,
  days = 365,
): Upcoming[] {
  const until = new Date(`${today}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + days);
  const limit = until.toISOString().slice(0, 10);

  const seen = new Set<string>();
  const out: Upcoming[] = [];
  for (const id of franchiseIds) {
    const franchise = index.franchisesById.get(id);
    if (!franchise) continue;
    for (const entry of franchise.entries) {
      const title = index.titlesById.get(entry.titleId);
      if (!title || seen.has(title.id) || title.releaseDate < today || title.releaseDate > limit) continue;
      seen.add(title.id);
      out.push({ title, franchise });
    }
  }
  return out.sort((a, b) => a.title.releaseDate.localeCompare(b.title.releaseDate) || a.title.id.localeCompare(b.title.id));
}
