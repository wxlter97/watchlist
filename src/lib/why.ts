import type { Lang } from "./types";

// "Por qué importa": por qué vale la pena ver ese título en su saga, escrito a mano (no se
// deduce de importancia ni continuidad). Un párrafo corto por título e idioma en
// src/data/why/{lang}/{titleId}.md, que se carga bajo demanda como los recaps.

const loaders = import.meta.glob<string>("../data/why/*/*.md", { query: "?raw", import: "default" });

const key = (lang: Lang, titleId: string) => `../data/why/${lang}/${titleId}.md`;

export const hasWhy = (lang: Lang, titleId: string): boolean => key(lang, titleId) in loaders;

export function loadWhy(lang: Lang, titleId: string): Promise<string> | undefined {
  return loaders[key(lang, titleId)]?.();
}
