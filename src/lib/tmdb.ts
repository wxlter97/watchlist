// Solo URLs públicas de imágenes: la API key de TMDB nunca llega al cliente (SPEC §2.6).

export type PosterSize = "w92" | "w154" | "w185" | "w342" | "w500";

export function posterUrl(path: string | undefined, size: PosterSize): string | undefined {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
}
