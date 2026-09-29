import type { Title } from "./types";

// Enlaces externos sin integración por API (SPEC §9.1).
// Trakt: la ruta /search/tmdb/{id} del SPEC ya no existe (Trakt migró a app.trakt.tv y
// devuelve 404, verificado en sept. 2026); se usa su búsqueda por título y año.

export type ExternalService = "letterboxd" | "imdb" | "trakt";

export function externalUrl(service: ExternalService, title: Title): string | undefined {
  switch (service) {
    case "letterboxd":
      return title.tmdbType === "movie" ? `https://letterboxd.com/tmdb/${title.tmdbId}/` : undefined;
    case "imdb":
      return title.imdbId ? `https://www.imdb.com/title/${title.imdbId}/` : undefined;
    case "trakt": {
      const query = `${title.title} ${title.releaseDate.slice(0, 4)}`;
      return `https://app.trakt.tv/search?query=${encodeURIComponent(query)}`;
    }
  }
}
