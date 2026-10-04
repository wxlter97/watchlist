// GET /api/upcoming?franchise=marvel,star-wars → próximos estrenos (SPEC §7).
// Toma los títulos por estrenar del catálogo con su fecha actual en TMDB, y las
// temporadas o episodios nuevos de las series que siguen en emisión.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { errorResponse, HttpError, json, tmdb } from "./_lib/tmdb.js";

interface CatalogTitle {
  id: string;
  tmdbId: number;
  tmdbType: "movie" | "tv";
  releaseDate: string;
  ongoing?: boolean;
}

export interface UpcomingItem {
  titleId: string;
  franchiseId: string;
  date: string;
  kind: "release" | "season" | "episode";
  season?: number;
  episode?: number;
}

const DATA = join(process.cwd(), "src", "data");
const read = <T,>(path: string): T => JSON.parse(readFileSync(join(DATA, path), "utf8")) as T;
const DAYS = 365;
const MAX_FRANCHISES = 80;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]!);
      }
    }),
  );
  return out;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const ids = (new URL(request.url).searchParams.get("franchise") ?? "").split(",").filter(Boolean);
    // Quien no sigue ninguna franquicia pide todas las del catálogo (hoy 44): el tope debe quedar por encima.
    if (!ids.length || ids.length > MAX_FRANCHISES || !ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))) {
      throw new HttpError(400, "franchise: uno o más ids separados por comas");
    }

    const titles = new Map(read<CatalogTitle[]>("titles.json").map((t) => [t.id, t]));
    const today = new Date().toISOString().slice(0, 10);
    const until = new Date(Date.now() + DAYS * 86_400_000).toISOString().slice(0, 10);

    const candidates: { title: CatalogTitle; franchiseId: string }[] = [];
    const seen = new Set<string>();
    for (const franchiseId of ids) {
      let entries: { titleId: string }[];
      try {
        entries = read<{ entries: { titleId: string }[] }>(join("franchises", `${franchiseId}.json`)).entries;
      } catch {
        throw new HttpError(404, `No existe la franquicia "${franchiseId}"`);
      }
      for (const { titleId } of entries) {
        const title = titles.get(titleId);
        if (!title || seen.has(title.id)) continue;
        // Lo que aún no se estrena (con margen: TMDB puede haber movido la fecha) y las series vivas.
        if (title.releaseDate >= today || title.ongoing) {
          seen.add(title.id);
          candidates.push({ title, franchiseId });
        }
      }
    }

    const results = await mapLimit(candidates, 8, async ({ title, franchiseId }): Promise<UpcomingItem | null> => {
      if (title.tmdbType === "movie") {
        const d = await tmdb<{ release_date?: string }>(`/movie/${title.tmdbId}`);
        const date = d.release_date || title.releaseDate;
        return date >= today ? { titleId: title.id, franchiseId, date, kind: "release" } : null;
      }
      const d = await tmdb<{
        first_air_date?: string;
        next_episode_to_air?: { air_date?: string; season_number: number; episode_number: number } | null;
      }>(`/tv/${title.tmdbId}`);
      if (d.first_air_date && d.first_air_date >= today) return { titleId: title.id, franchiseId, date: d.first_air_date, kind: "release" };
      const next = d.next_episode_to_air;
      if (!next?.air_date || next.air_date < today) return null;
      return {
        titleId: title.id,
        franchiseId,
        date: next.air_date,
        kind: next.episode_number === 1 ? "season" : "episode",
        season: next.season_number,
        episode: next.episode_number,
      };
    });

    const items = results
      .filter((x): x is UpcomingItem => x !== null && x.date <= until)
      .sort((a, b) => a.date.localeCompare(b.date) || a.titleId.localeCompare(b.titleId));
    return json({ generatedAt: new Date().toISOString(), items }, { maxAge: 21_600 });
  } catch (err) {
    return errorResponse(err);
  }
}
