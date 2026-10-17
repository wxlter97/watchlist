// watch-order: cliente de la API pública de Watch Order (https://watchlist.wxlter.dev/developers).
// Sin dependencias; Node 18+ (fetch incluido). Salida legible, o JSON con --json para scripts y agentes.
export const VERSION = "1.0.0";
export const DEFAULT_BASE_URL = "https://watchlist.wxlter.dev";

const HELP = `watch-order — what order to watch movie and TV franchises in

Usage: watch-order <command> [options]

Commands:
  franchises                         List every franchise (id, name, titles)
  order <franchise> [--order <id>]   Titles of a franchise in a watch order (default: release)
  title <titleId>                    One title and the franchises it belongs to
  upcoming <franchise[,franchise]>   Releases, seasons and episodes in the next 365 days
  providers <tmdbId> <movie|tv>      Where to watch a title (--region US, default SV)
  credits <tmdbId> <movie|tv>        Main cast of a title
  health                             Service status

Options:
  --lang <en|es>      Language of names and descriptions (default: en)
  --json              Print the raw JSON response
  --base-url <url>    API origin (default: ${DEFAULT_BASE_URL}, or $WATCH_ORDER_URL)
  -h, --help          Show this help
  -v, --version       Show the version

Examples:
  watch-order franchises
  watch-order order marvel --order chronological
  watch-order order star-wars --lang es --json

No account or API key. Rate limit: 60 requests per minute (the CLI waits and retries once on 429).
Docs: ${DEFAULT_BASE_URL}/developers · OpenAPI: ${DEFAULT_BASE_URL}/openapi.json
`;

/** Separa banderas (--x valor, --json) de argumentos posicionales. */
export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") flags.help = true;
    else if (a === "-v" || a === "--version") flags.version = true;
    else if (a === "--json") flags.json = true;
    else if (a.startsWith("--")) {
      const [name, inline] = a.slice(2).split(/=(.*)/s, 2);
      const value = inline ?? argv[++i];
      if (value === undefined || value.startsWith("--")) throw new UsageError(`Missing value for --${name}`);
      flags[name] = value;
    } else positional.push(a);
  }
  return { flags, positional };
}

export class UsageError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET con un reintento si la API responde 429 (espera Retry-After, máximo 30 s). */
export async function request(base, path, params, fetchImpl = fetch) {
  const url = new URL(`/api/v1${path}`, base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  let res = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": `watch-order-cli/${VERSION}` } });
  if (res.status === 429) {
    const wait = Math.min(30, Number(res.headers.get("retry-after")) || 1);
    await sleep(wait * 1000);
    res = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": `watch-order-cli/${VERSION}` } });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body.error ?? `HTTP ${status}`);
    this.status = status;
    this.hint = body.hint;
  }
}

const pad = (s, n) => String(s).padEnd(n);

const FORMATTERS = {
  franchises: (d) => d.franchises.map((f) => `${pad(f.id, 28)}${pad(f.name, 32)}${f.titleCount} titles`).join("\n"),
  order: (d) =>
    `${d.name} — ${d.order.name}\n` +
    d.order.items.map((i) => `${pad(i.position, 4)}${pad(i.title, 52)}${pad(i.releaseDate, 12)}${i.importance}`).join("\n") +
    `\n\nOrders: ${d.orders.map((o) => o.id).join(", ")}\n${d.url}`,
  title: (d) =>
    `${d.title} (${d.releaseDate.slice(0, 4)}, ${d.kind})\n${d.overview ?? ""}\nFranchises: ${d.franchises.map((f) => f.id).join(", ")}\n${d.url}`,
  upcoming: (d) => (d.items.length ? d.items.map((i) => `${i.date}  ${pad(i.franchiseId, 24)}${i.titleId} (${i.kind})`).join("\n") : "Nothing upcoming."),
  providers: (d) =>
    ["flatrate", "free", "ads", "rent", "buy"].map((k) => `${pad(k, 9)}${d[k].map((p) => p.name).join(", ") || "-"}`).join("\n") + (d.link ? `\n${d.link}` : ""),
  credits: (d) => d.cast.map((c) => `${pad(c.name, 30)}${c.character}`).join("\n"),
  health: (d) => `ok${d.commit ? ` (${d.commit})` : ""} ${d.time}`,
};

/** Convierte comando + argumentos en { path, params, format }, o lanza UsageError. */
export function plan(command, positional, flags) {
  const need = (n, usage) => {
    if (positional.length < n) throw new UsageError(`Usage: watch-order ${usage}`);
  };
  const lang = flags.lang;
  if (lang !== undefined && lang !== "en" && lang !== "es") throw new UsageError("--lang must be en or es");
  const media = () => {
    need(2, `${command} <tmdbId> <movie|tv>`);
    if (positional[1] !== "movie" && positional[1] !== "tv") throw new UsageError("Type must be movie or tv");
    return { tmdbId: positional[0], type: positional[1] };
  };
  switch (command) {
    case "franchises":
      return { path: "/franchises", params: { lang }, format: "franchises" };
    case "order":
      need(1, "order <franchise> [--order <id>]");
      return { path: `/franchises/${encodeURIComponent(positional[0])}`, params: { order: flags.order, lang }, format: "order" };
    case "title":
      need(1, "title <titleId>");
      return { path: `/titles/${encodeURIComponent(positional[0])}`, params: { lang }, format: "title" };
    case "upcoming":
      need(1, "upcoming <franchise[,franchise]>");
      return { path: "/upcoming", params: { franchise: positional[0] }, format: "upcoming" };
    case "providers":
      return { path: "/providers", params: { ...media(), region: flags.region }, format: "providers" };
    case "credits":
      return { path: "/credits", params: media(), format: "credits" };
    case "health":
      return { path: "/health", params: {}, format: "health" };
    default:
      throw new UsageError(`Unknown command "${command}". Run watch-order --help.`);
  }
}

/** Punto de entrada: devuelve el código de salida (0 bien, 1 error de la API, 2 uso incorrecto). */
export async function run(argv, { stdout, stderr, fetch: fetchImpl = fetch, env = process.env } = {}) {
  try {
    const { flags, positional } = parseArgs(argv);
    if (flags.version) {
      stdout.write(`${VERSION}\n`);
      return 0;
    }
    if (flags.help || positional.length === 0) {
      stdout.write(HELP);
      return 0;
    }
    const [command, ...rest] = positional;
    const { path, params, format } = plan(command, rest, flags);
    const base = flags["base-url"] ?? env.WATCH_ORDER_URL ?? DEFAULT_BASE_URL;
    const data = await request(base, path, params, fetchImpl);
    stdout.write(flags.json ? `${JSON.stringify(data, null, 2)}\n` : `${FORMATTERS[format](data)}\n`);
    return 0;
  } catch (err) {
    if (err instanceof UsageError) {
      stderr.write(`${err.message}\n`);
      return 2;
    }
    if (err instanceof ApiError) {
      stderr.write(`Error ${err.status}: ${err.message}${err.hint ? `\n${err.hint}` : ""}\n`);
      return 1;
    }
    stderr.write(`Request failed: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}
