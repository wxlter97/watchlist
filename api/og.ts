// GET /api/og?kind=achievement|franchise|stats|wrapped&lang=es&… → tarjeta PNG de 1080×1080
// para compartir (SPEC §7, §9.4). Los números llegan en la URL: son los que el usuario decide
// compartir, no se lee su progreso. Mismos parámetros, misma imagen: caché larga en el CDN.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type satoriType from "satori";
import type { Achievement, Lang, LocalizedText } from "../src/lib/types.js";
import { achievementCard, franchiseCard, OG, shareCard, SIZE, statsCard, wrappedCard, type El } from "./_lib/cards.js";
import { FONT_FILES } from "./_lib/fonts.js";
import { loadShare } from "./_lib/shares.js";
import { errorResponse, HttpError } from "./_lib/tmdb.js";

const ROOT = process.cwd();
const DATA = join(ROOT, "src", "data");
const read = <T,>(path: string): T => JSON.parse(readFileSync(join(DATA, path), "utf8")) as T;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

let fonts: Parameters<typeof satoriType>[1]["fonts"] | undefined;
function loadFonts() {
  const font = (file: string) => Buffer.from(FONT_FILES[file]!, "base64");
  fonts ??= [
    { name: "Archivo Black", data: font("archivo-black-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Archivo", data: font("archivo-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Archivo", data: font("archivo-latin-700-normal.woff"), weight: 700, style: "normal" },
    { name: "JetBrains Mono", data: font("jetbrains-mono-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "JetBrains Mono", data: font("jetbrains-mono-latin-700-normal.woff"), weight: 700, style: "normal" },
  ];
  return fonts;
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

const localize = (text: LocalizedText | undefined, lang: Lang) =>
  typeof text === "string" ? text : (text?.[lang] ?? text?.es ?? text?.en ?? "");

function int(params: URLSearchParams, key: string, max: number, optional = false): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw === "") {
    if (optional) return undefined;
    throw new HttpError(400, `${key}: requerido`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new HttpError(400, `${key}: entero entre 0 y ${max}`);
  return n;
}

function slug(params: URLSearchParams, key: string, optional = false): string | undefined {
  const raw = params.get(key);
  if (!raw && optional) return undefined;
  if (!raw || !SLUG.test(raw)) throw new HttpError(400, `${key}: id inválido`);
  return raw;
}

function franchise(id: string) {
  try {
    return read<{ name: LocalizedText; accentColor: string }>(join("franchises", `${id}.json`));
  } catch {
    throw new HttpError(404, `No existe la franquicia "${id}"`);
  }
}

function titleName(id: string, lang: Lang): string {
  const t = read<{ id: string; title: string; localized?: Partial<Record<Lang, { title: string }>> }[]>("titles.json").find((x) => x.id === id);
  if (!t) throw new HttpError(404, `No existe el título "${id}"`);
  return t.localized?.[lang]?.title ?? t.title;
}

async function buildCard(params: URLSearchParams): Promise<{ card: El; size: { width: number; height: number } }> {
  if (params.get("kind") === "share") {
    // Vista previa de un link compartido: lee el snapshot público (no el progreso vivo).
    const lang: Lang = params.get("lang") === "en" ? "en" : "es";
    const share = await loadShare(params.get("id") ?? "");
    const f = franchise(share.franchiseId) as { name: LocalizedText; accentColor: string; routes?: { id: string; name: LocalizedText }[] };
    const route = share.kind === "route" ? f.routes?.find((r) => r.id === share.refId) : undefined;
    const card = shareCard(lang, {
      kind: share.kind,
      title: route ? localize(route.name, lang) : share.title,
      owner: share.ownerName,
      franchise: localize(f.name, lang),
      accent: f.accentColor,
      watched: share.snapshot.watched.length,
      total: share.snapshot.titleIds.length,
    });
    return { card, size: OG };
  }
  return { card: buildSquare(params), size: { width: SIZE, height: SIZE } };
}

function buildSquare(params: URLSearchParams): El {
  const lang: Lang = params.get("lang") === "en" ? "en" : "es";
  const kind = params.get("kind");
  switch (kind) {
    case "achievement": {
      const id = slug(params, "id")!;
      const a = read<Achievement[]>("achievements.json").find((x) => x.id === id);
      if (!a) throw new HttpError(404, `No existe el logro "${id}"`);
      const d = params.get("d");
      const date =
        d && /^\d{4}-\d{2}-\d{2}$/.test(d)
          ? new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))
          : undefined;
      return achievementCard(lang, { name: localize(a.name, lang), description: localize(a.description, lang), icon: a.icon }, date);
    }
    case "franchise": {
      const f = franchise(slug(params, "id")!);
      return franchiseCard(lang, { name: localize(f.name, lang), accent: f.accentColor }, int(params, "n", 10_000)!, int(params, "h", 100_000)!);
    }
    case "stats": {
      const r = int(params, "r", 50, true);
      const f = slug(params, "f", true);
      return statsCard(lang, {
        hours: int(params, "h", 100_000)!,
        titles: int(params, "t", 100_000)!,
        rating: r === undefined ? undefined : r / 10,
        franchise: f ? localize(franchise(f).name, lang) : undefined,
      });
    }
    case "wrapped": {
      const f = slug(params, "f", true);
      const top = slug(params, "top", true);
      const m = int(params, "m", 12, true);
      const year = int(params, "y", 2100)!;
      if (year < 2000) throw new HttpError(400, "y: año inválido");
      return wrappedCard(lang, {
        year,
        hours: int(params, "h", 100_000)!,
        titles: int(params, "t", 100_000)!,
        franchise: f ? localize(franchise(f).name, lang) : undefined,
        topTitle: top ? titleName(top, lang) : undefined,
        month: m
          ? capitalize(new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, m - 1, 1))))
          : undefined,
        achievements: int(params, "a", 1000)!,
      });
    }
    default:
      throw new HttpError(400, "kind: achievement, franchise, stats, wrapped o share");
  }
}

/**
 * satori y resvg (con su binario nativo) se cargan aquí y no al inicio del módulo: si el
 * binario no llega al empaquetado de Vercel, la función falla al arrancar sin dejar rastro
 * (FUNCTION_INVOCATION_FAILED). Así el error sale en los logs y en la respuesta.
 */
async function renderer() {
  try {
    const [{ default: satori }, { Resvg }] = await Promise.all([import("satori"), import("@resvg/resvg-js")]);
    return { satori, Resvg };
  } catch (err) {
    console.error("[og] no se pudo cargar satori/resvg", err);
    throw new HttpError(500, `No se pudo cargar el renderizador: ${err instanceof Error ? err.message.split("\n")[0] : "desconocido"}`);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const { card, size } = await buildCard(params);
    const { satori, Resvg } = await renderer();
    const svg = await satori(card as unknown as Parameters<typeof satoriType>[0], { ...size, fonts: loadFonts() });
    const png = new Resvg(svg, { fitTo: { mode: "width", value: size.width } }).render().asPng();
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Tarjetas: mismos parámetros, misma imagen. Links: la URL lleva v=updatedAt, pero
        // uno revocado debe dejar de verse pronto.
        "Cache-Control":
          params.get("kind") === "share"
            ? "public, max-age=300, s-maxage=3600"
            : "public, max-age=86400, s-maxage=31536000, immutable",
      },
    });
  } catch (err) {
    // Un fallo interno de la tarjeta deja el motivo (primera línea) en la respuesta, para poder diagnosticarlo.
    if (!(err instanceof HttpError)) {
      console.error("[og]", err);
      return new Response(JSON.stringify({ error: "Error interno", detail: err instanceof Error ? err.message.split("\n")[0] : String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    return errorResponse(err);
  }
}
