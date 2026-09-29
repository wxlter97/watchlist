// GET /api/providers?tmdbId=&type=movie|tv&region=SV → dónde ver (SPEC §7).
// Datos de JustWatch vía TMDB: la UI debe mostrar la atribución.
import { errorResponse, HttpError, json, tmdb } from "./_lib/tmdb";

interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}
type Offer = "flatrate" | "free" | "ads" | "rent" | "buy";
const OFFERS: Offer[] = ["flatrate", "free", "ads", "rent", "buy"];

interface TmdbProviders {
  results: Record<string, { link: string } & Partial<Record<Offer, TmdbProvider[]>>>;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const tmdbId = params.get("tmdbId") ?? "";
    const type = params.get("type") ?? "";
    const region = (params.get("region") ?? "SV").toUpperCase();
    if (!/^\d{1,9}$/.test(tmdbId) || (type !== "movie" && type !== "tv") || !/^[A-Z]{2}$/.test(region)) {
      throw new HttpError(400, "Parámetros inválidos: tmdbId numérico, type movie|tv, region ISO de 2 letras");
    }

    const data = await tmdb<TmdbProviders>(`/${type}/${tmdbId}/watch/providers`);
    const found = data.results[region];
    const offers = Object.fromEntries(
      OFFERS.map((offer) => [
        offer,
        (found?.[offer] ?? [])
          .sort((a, b) => a.display_priority - b.display_priority)
          .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path })),
      ]),
    );
    return json({ region, link: found?.link ?? null, ...offers }, { maxAge: 86_400 });
  } catch (err) {
    return errorResponse(err);
  }
}
