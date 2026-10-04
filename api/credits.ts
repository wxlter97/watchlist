// GET /api/credits?tmdbId=&type=movie|tv → reparto principal de un título.
// Películas: /credits. Series: /aggregate_credits (suma todos los papeles de cada actor).
import { errorResponse, HttpError, json, tmdb } from "./_lib/tmdb.js";

interface TmdbCast {
  id: number;
  name: string;
  profile_path: string | null;
  order?: number;
  character?: string;
  roles?: { character: string; episode_count: number }[];
  total_episode_count?: number;
}

const LIMIT = 24;

export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const tmdbId = params.get("tmdbId") ?? "";
    const type = params.get("type") ?? "";
    if (!/^\d{1,9}$/.test(tmdbId) || (type !== "movie" && type !== "tv")) {
      throw new HttpError(400, "Parámetros inválidos: tmdbId numérico, type movie|tv");
    }

    const data = await tmdb<{ cast: TmdbCast[] }>(`/${type}/${tmdbId}/${type === "tv" ? "aggregate_credits" : "credits"}`);
    const cast = data.cast
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .slice(0, LIMIT)
      .map((p) => ({
        id: p.id,
        name: p.name,
        character: p.character ?? p.roles?.[0]?.character ?? "",
        profilePath: p.profile_path,
        ...(p.total_episode_count ? { episodes: p.total_episode_count } : {}),
      }));
    return json({ cast }, { maxAge: 86_400 });
  } catch (err) {
    return errorResponse(err);
  }
}
