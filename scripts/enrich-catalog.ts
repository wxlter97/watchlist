// Completa titles.json con datos de TMDB (SPEC §4.5) y reporta diferencias con lo
// que ya estaba escrito, para que el catálogo quede verificado contra la fuente.
//
//   pnpm catalog:enrich                 todos los títulos
//   pnpm catalog:enrich --only a,b      solo esos ids
//   pnpm catalog:enrich --dry-run       reporta sin escribir
//
// Requiere TMDB_API_KEY (API Read Access Token) en .env.local.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Lang, Title } from "../src/lib/types.ts";

const TITLES_PATH = fileURLToPath(new URL("../src/data/titles.json", import.meta.url));
const API = "https://api.themoviedb.org/3";
const LANGS: Record<Lang, string> = { en: "en-US", es: "es-MX" };
const CONCURRENCY = 6;

const token = process.env.TMDB_API_KEY;
if (!token) {
  console.error("Falta TMDB_API_KEY. Agrégalo a .env.local.");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyArg = args[args.indexOf("--only") + 1];
const only = args.includes("--only") && onlyArg ? new Set(onlyArg.split(",")) : undefined;

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; ; attempt++) {
    const backoff = () => new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    } catch (err) {
      // Cortes de red: se reintentan igual que los límites de TMDB.
      if (attempt < 5) {
        await backoff();
        continue;
      }
      throw err;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await backoff();
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} en ${path}`);
    return (await res.json()) as T;
  }
}

interface TmdbDetails {
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  seasons?: { season_number: number; episode_count: number; air_date: string | null }[];
  external_ids?: { imdb_id: string | null };
  status?: string;
}

interface TmdbSeason {
  episodes: { runtime: number | null }[];
}

type Change = { id: string; field: string; from: unknown; to: unknown };

async function enrich(t: Title, changes: Change[]): Promise<Title> {
  const base = `/${t.tmdbType}/${t.tmdbId}`;
  const [en, es] = await Promise.all([
    tmdb<TmdbDetails>(base, { language: LANGS.en, append_to_response: "external_ids" }),
    tmdb<TmdbDetails>(base, { language: LANGS.es }),
  ]);

  const next: Title = { ...t };
  const set = <K extends keyof Title>(field: K, value: Title[K] | undefined, report = true) => {
    if (value === undefined || value === null || value === "") return;
    if (report && JSON.stringify(next[field]) !== JSON.stringify(value))
      changes.push({ id: t.id, field, from: next[field], to: value });
    next[field] = value;
  };

  set("title", en.title ?? en.name);
  set("releaseDate", en.release_date || en.first_air_date || undefined);
  set("imdbId", en.external_ids?.imdb_id ?? undefined);
  set("posterPath", en.poster_path ?? undefined, false);
  set("overview", en.overview, false);

  const localized: NonNullable<Title["localized"]> = {};
  for (const [lang, d] of [["en", en], ["es", es]] as const) {
    const title = d.title ?? d.name;
    // Si TMDB no tiene sinopsis en ese idioma se conserva la ya escrita (traducciones propias del catálogo).
    const overview = d.overview || t.localized?.[lang]?.overview;
    if (title) localized[lang] = { title, ...(overview ? { overview } : {}) };
  }
  set("localized", localized, false);

  if (t.tmdbType === "movie") {
    set("runtimeMin", en.runtime || undefined);
  } else {
    const seasons = (en.seasons ?? [])
      .filter((s) => s.season_number > 0 && s.episode_count > 0)
      // La fecha de cada temporada ordena las entries por temporada en el orden de estreno.
      .map((s) => ({ number: s.season_number, episodes: s.episode_count, ...(s.air_date ? { airDate: s.air_date } : {}) }));
    set("seasons", seasons.length ? seasons : undefined);

    // Duración total real: suma de los episodios; si TMDB no la tiene, promedio × episodios.
    let total = 0;
    for (const s of seasons) {
      const season = await tmdb<TmdbSeason>(`${base}/season/${s.number}`, { language: LANGS.en });
      const fallback = en.episode_run_time?.[0] ?? 0;
      total += season.episodes.reduce((sum, ep) => sum + (ep.runtime ?? fallback), 0);
    }
    set("runtimeMin", total || undefined);

    // /api/upcoming solo revisa temporadas nuevas de las series que siguen vivas.
    if (["Returning Series", "In Production", "Planned", "Pilot"].includes(en.status ?? "")) next.ongoing = true;
    else delete next.ongoing;
  }
  return next;
}

const titles: Title[] = JSON.parse(readFileSync(TITLES_PATH, "utf8"));
const targets = titles.filter((t) => !only || only.has(t.id));
const changes: Change[] = [];
const failures: string[] = [];
const results = new Map<string, Title>();

let cursor = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < targets.length) {
      const t = targets[cursor++]!;
      try {
        results.set(t.id, await enrich(t, changes));
      } catch (err) {
        failures.push(`${t.id} (${t.tmdbType}/${t.tmdbId}): ${(err as Error).message}`);
      }
    }
  }),
);

const updated = titles.map((t) => results.get(t.id) ?? t);

console.log(`\n${results.size}/${targets.length} títulos consultados en TMDB.`);
if (changes.length) {
  console.log(`\nDiferencias con el catálogo (${changes.length}):`);
  for (const c of changes) console.log(`  ${c.id} · ${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);
}
const missing = updated.filter((t) => results.has(t.id) && (!t.runtimeMin || !t.posterPath));
if (missing.length) {
  console.log(`\nSin duración o póster en TMDB (normal en anunciados):`);
  for (const t of missing) console.log(`  ${t.id} (${t.releaseDate})`);
}
if (failures.length) {
  console.error(`\nFallaron (${failures.length}):`);
  for (const f of failures) console.error(`  ${f}`);
}

if (!dryRun) {
  writeFileSync(TITLES_PATH, JSON.stringify(updated, null, 2) + "\n");
  console.log(`\nEscrito ${TITLES_PATH}`);
}
process.exit(failures.length ? 1 : 0);
