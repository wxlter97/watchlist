import { useEffect, useState } from "react";
import { titleOverview } from "./i18n";
import type { Lang, Title } from "./types";

// Sinopsis: fuera del catálogo del arranque (ver catalogSplit en vite.config.ts). Se cargan
// por idioma la primera vez que se abre un título; el service worker las deja offline.

const loaders: Record<Lang, () => Promise<{ default: Record<string, string> }>> = {
  es: () => import("virtual:overviews/es"),
  en: () => import("virtual:overviews/en"),
};
const cache: Partial<Record<Lang, Record<string, string>>> = {};

export function loadOverviews(lang: Lang): Promise<Record<string, string>> {
  const cached = cache[lang];
  if (cached) return Promise.resolve(cached);
  return loaders[lang]().then((m) => (cache[lang] = m.default));
}

/** La sinopsis del título en el idioma, o `loading` mientras llega el archivo. */
export function useOverview(title: Title | undefined, lang: Lang): { overview?: string; loading: boolean } {
  const [, setLoaded] = useState(0);
  const map = cache[lang];
  useEffect(() => {
    if (cache[lang]) return;
    let alive = true;
    loadOverviews(lang).then(
      () => alive && setLoaded((n) => n + 1),
      (err) => console.error("[overviews]", err),
    );
    return () => {
      alive = false;
    };
  }, [lang]);
  // Los títulos que ya traen sinopsis (fixtures de tests) no esperan al archivo.
  const own = title && titleOverview(title, lang);
  if (own) return { overview: own, loading: false };
  return { overview: title && map?.[title.id], loading: !map };
}
