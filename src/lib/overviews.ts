import { useEffect, useState } from "react";
import { overviews as loaders } from "virtual:catalog-loaders";
import { franchiseIdsByTitle } from "./catalog";
import { titleOverview } from "./i18n";
import type { Lang, Title } from "./types";

// Sinopsis: fuera del catálogo (ver catalogData en vite.config.ts). Se cargan por idioma y
// franquicia la primera vez que se abre un título; el service worker las deja offline.

const cache = new Map<string, Record<string, string>>();
const keyOf = (lang: Lang, franchiseId: string) => `${lang}/${franchiseId}`;

export function loadOverviews(lang: Lang, franchiseId: string): Promise<Record<string, string>> {
  const key = keyOf(lang, franchiseId);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const load = loaders[lang][franchiseId];
  if (!load) return Promise.resolve({});
  return load().then((m) => {
    cache.set(key, m.default);
    return m.default;
  });
}

/** La sinopsis del título en el idioma, o `loading` mientras llega el archivo. */
export function useOverview(title: Title | undefined, lang: Lang): { overview?: string; loading: boolean } {
  const [, setLoaded] = useState(0);
  const franchiseId = title ? franchiseIdsByTitle.get(title.id)?.[0] : undefined;
  const map = franchiseId ? cache.get(keyOf(lang, franchiseId)) : undefined;
  useEffect(() => {
    if (!franchiseId || cache.has(keyOf(lang, franchiseId))) return;
    let alive = true;
    loadOverviews(lang, franchiseId).then(
      () => alive && setLoaded((n) => n + 1),
      (err) => console.error("[overviews]", err),
    );
    return () => {
      alive = false;
    };
  }, [lang, franchiseId]);
  // Los títulos que ya traen sinopsis (fixtures de tests) no esperan al archivo.
  const own = title && titleOverview(title, lang);
  if (own) return { overview: own, loading: false };
  return { overview: title && map?.[title.id], loading: Boolean(franchiseId) && !map };
}
