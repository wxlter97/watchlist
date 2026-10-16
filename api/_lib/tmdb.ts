// Cliente de TMDB solo para el servidor: la API key nunca llega al cliente (SPEC §2.6).

const API = "https://api.themoviedb.org/3";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Qué hacer para corregirlo; sale como `hint` en el JSON de error. */
    readonly hint?: string,
  ) {
    super(message);
  }
}

/** Código estable por status, para que un cliente (o un agente) no tenga que leer el mensaje. */
const CODES: Record<number, string> = {
  400: "invalid_request",
  401: "unauthorized",
  404: "not_found",
  405: "method_not_allowed",
  409: "conflict",
  413: "payload_too_large",
  429: "rate_limited",
  500: "internal_error",
  502: "upstream_error",
};
export const errorCode = (status: number) => CODES[status] ?? (status >= 500 ? "internal_error" : "invalid_request");

/** Documentación de la API (errores incluidos); va en cada respuesta de error. */
export const API_DOCS = "/developers";

export async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_API_KEY;
  if (!token) throw new HttpError(500, "TMDB_API_KEY no está configurada");
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 404) throw new HttpError(404, "No existe en TMDB");
  if (!res.ok) throw new HttpError(502, `TMDB respondió ${res.status}`);
  return (await res.json()) as T;
}

export function json(body: unknown, init: { status?: number; maxAge?: number; cors?: boolean } = {}): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
  // La API pública del catálogo se puede leer desde cualquier origen (no lleva sesión).
  if (init.cors) headers["Access-Control-Allow-Origin"] = "*";
  // Caché en el CDN de Vercel; el navegador siempre revalida.
  if (init.maxAge) headers["Cache-Control"] = `public, max-age=0, s-maxage=${init.maxAge}, stale-while-revalidate=${init.maxAge * 7}`;
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

/**
 * Error en JSON: `error` (el mensaje, como siempre), `code`, `status`, `hint` y `docs`.
 * Los clientes de la app solo miran el status; los demás campos son para quien integre la API.
 */
export function apiError(status: number, message: string, hint?: string): Response {
  return json({ error: message, code: errorCode(status), status, ...(hint ? { hint } : {}), docs: `${API_DOCS}#errors` }, { status });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return apiError(err.status, err.message, err.hint);
  console.error(err);
  return apiError(500, "Error interno", "Try again later. If it keeps failing, write to work@wxlter.dev.");
}
