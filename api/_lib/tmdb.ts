// Cliente de TMDB solo para el servidor: la API key nunca llega al cliente (SPEC §2.6).

const API = "https://api.themoviedb.org/3";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

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

export function json(body: unknown, init: { status?: number; maxAge?: number } = {}): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
  // Caché en el CDN de Vercel; el navegador siempre revalida.
  if (init.maxAge) headers["Cache-Control"] = `public, max-age=0, s-maxage=${init.maxAge}, stale-while-revalidate=${init.maxAge * 7}`;
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
  console.error(err);
  return json({ error: "Error interno" }, { status: 500 });
}
