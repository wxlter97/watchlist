import type { CatalogIndex } from "./catalogIndex";
import { prepUnits } from "./prep";
import type { Continuity, Franchise, Importance, Lang, LocalizedText, Title } from "./types";

// Recaps (SPEC §9.3): "lo que necesitas recordar" antes de ver un título lista todo lo previo que
// le importa (su linaje, no todo lo estrenado antes), con el motivo. Los recaps de lo que aún no
// viste quedan ocultos tras un aviso mientras el modo sin spoilers esté activo. Los textos viven en
// src/data/recaps/{lang}/{titleId}.md y se cargan bajo demanda.

const loaders = import.meta.glob<string>("../data/recaps/*/*.md", { query: "?raw", import: "default" });

const key = (lang: Lang, titleId: string) => `../data/recaps/${lang}/${titleId}.md`;

export function hasRecap(lang: Lang, titleId: string): boolean {
  return key(lang, titleId) in loaders;
}

export function loadRecap(lang: Lang, titleId: string): Promise<string> | undefined {
  return loaders[key(lang, titleId)]?.();
}

/** Todos los ids con recap en un idioma (para el validador). */
export function recapIds(lang: Lang): string[] {
  const prefix = `../data/recaps/${lang}/`;
  return Object.keys(loaders)
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length, -3));
}

const RANK: Record<Importance, number> = { essential: 0, recommended: 1, optional: 2, skippable: 3 };

/** Un título que hay que conocer antes de `titleId`, y por qué. */
export interface RecapSource {
  title: Title;
  franchise: Franchise;
  continuity?: Continuity;
  importance: Importance;
  /** Está en la selección mínima ("Prepárate para…") de esa franquicia. */
  inMinimum: boolean;
  chronoNote?: LocalizedText;
}

/**
 * Todo lo que viene antes de `titleId` en su linaje (lo mismo que "Prepárate para…"), visto o
 * no, con el motivo de su relevancia. Una sola vez por título, de lo más importante a lo menos
 * y, dentro de cada nivel, lo más cercano primero.
 */
export function recapSources(titleId: string, index: CatalogIndex): RecapSource[] {
  const franchises = [...new Map((index.franchisesByTitle.get(titleId) ?? []).map((a) => [a.franchise.id, a.franchise])).values()];
  const found = new Map<string, RecapSource & { at: number }>();
  for (const franchise of franchises) {
    const minimum = new Set(prepUnits(franchise, titleId, "minimum", index).map((i) => i.title.id));
    for (const item of prepUnits(franchise, titleId, "all", index)) {
      const { entry } = item;
      if (!entry) continue;
      const prev = found.get(item.title.id);
      if (prev && RANK[prev.importance] <= RANK[entry.importance]) continue;
      found.set(item.title.id, {
        title: item.title,
        franchise,
        continuity: franchise.continuities.find((c) => c.id === entry.continuityId),
        importance: entry.importance,
        inMinimum: minimum.has(item.title.id),
        chronoNote: entry.chronoNote,
        at: item.position,
      });
    }
  }
  return [...found.values()]
    .sort((a, b) => RANK[a.importance] - RANK[b.importance] || b.at - a.at)
    .map(({ at: _at, ...source }) => source);
}
