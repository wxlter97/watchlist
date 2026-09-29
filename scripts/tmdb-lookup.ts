// Busca en TMDB los ids para agregar títulos al catálogo (SPEC §3.3: verificar todo contra TMDB).
//
//   pnpm catalog:lookup search movie|tv|collection <texto>
//   pnpm catalog:lookup collection <id> [<id>…]     películas de una colección, por fecha
//   pnpm catalog:lookup movie|tv <id> [<id>…]       fecha, estado, duración y temporadas
//
// Después de agregar los títulos a titles.json (id, tmdbId, tmdbType, title, kind,
// releaseDate), `pnpm catalog:enrich --only <ids>` completa el resto y reporta diferencias.

const token = process.env.TMDB_API_KEY;
if (!token) {
  console.error("Falta TMDB_API_KEY. Agrégalo a .env.local.");
  process.exit(1);
}

interface Item {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  status?: string;
  runtime?: number;
  episode_run_time?: number[];
  seasons?: { season_number: number; episode_count: number; air_date: string | null }[];
  parts?: Item[];
  results?: Item[];
}

async function api(path: string, params: Record<string, string> = {}): Promise<Item> {
  const res = await fetch(`https://api.themoviedb.org/3${path}?${new URLSearchParams({ language: "en-US", ...params })}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} en ${path}`);
  return (await res.json()) as Item;
}

const date = (x: Item) => x.release_date || x.first_air_date || "?";
const name = (x: Item) => x.title ?? x.name ?? "?";
const [cmd, first, ...rest] = process.argv.slice(2);

if (cmd === "search" && first) {
  const { results = [] } = await api(`/search/${first}`, { query: rest.join(" ") });
  for (const x of results.slice(0, 10)) console.log([first, x.id, date(x), name(x), x.original_language ?? ""].join("\t"));
} else if (cmd === "collection" && first) {
  for (const id of [first, ...rest]) {
    const c = await api(`/collection/${id}`);
    console.log(`# ${name(c)} (${id})`);
    for (const p of [...(c.parts ?? [])].sort((a, b) => date(a).localeCompare(date(b)))) console.log([p.media_type ?? "movie", p.id, date(p), name(p)].join("\t"));
  }
} else if ((cmd === "movie" || cmd === "tv") && first) {
  for (const id of [first, ...rest]) {
    const x = await api(`/${cmd}/${id}`);
    const seasons = (x.seasons ?? []).filter((s) => s.season_number > 0).map((s) => `T${s.season_number}:${s.episode_count}`).join(" ");
    console.log([cmd, id, date(x), name(x), x.status ?? "", `${x.runtime ?? x.episode_run_time?.[0] ?? "?"} min`, seasons].join("\t"));
  }
} else {
  console.log("Uso: pnpm catalog:lookup search movie|tv|collection <texto> | collection <id…> | movie|tv <id…>");
  process.exit(1);
}

export {};
