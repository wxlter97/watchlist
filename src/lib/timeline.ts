import type { Continuity, Entry, Franchise, Title } from "./types";
import { unitReleaseDate } from "./units";

// Línea de tiempo (SPEC §9.3): un carril por continuidad, en orden in-universe
// (chronoOrder). Una continuidad que se separa de otra (branchesFrom) empieza justo
// después del título donde se separa, y se dibuja debajo de su origen.

export interface TimelineItem {
  entry: Entry;
  title: Title;
  /** Columna en el eje horizontal. */
  slot: number;
}

export interface TimelineLane {
  continuity: Continuity;
  items: TimelineItem[];
  /** Carril y columna del título del que se separa. */
  branch?: { lane: number; slot: number };
  /** Profundidad de la rama (0 = continuidad raíz), para la sangría del nombre. */
  depth: number;
}

export interface Timeline {
  lanes: TimelineLane[];
  /** Columnas totales. */
  width: number;
}

const byChrono = (a: { entry: Entry; title: Title }, b: { entry: Entry; title: Title }) =>
  (a.entry.chronoOrder ?? Infinity) - (b.entry.chronoOrder ?? Infinity) ||
  unitReleaseDate(a.title, a.entry.season).localeCompare(unitReleaseDate(b.title, b.entry.season)) ||
  a.title.id.localeCompare(b.title.id);

export function buildTimeline(
  franchise: Franchise,
  titlesById: ReadonlyMap<string, Title>,
  hiddenContinuities: readonly string[] = [],
): Timeline {
  const hidden = new Set(hiddenContinuities);
  const visible = franchise.continuities.filter((c) => !hidden.has(c.id));

  const entriesOf = new Map<string, { entry: Entry; title: Title }[]>();
  for (const entry of franchise.entries) {
    const title = titlesById.get(entry.titleId);
    if (!title || hidden.has(entry.continuityId)) continue;
    const list = entriesOf.get(entry.continuityId) ?? [];
    list.push({ entry, title });
    entriesOf.set(entry.continuityId, list);
  }

  // Una rama cuenta solo si su origen está visible y contiene el título de separación.
  const parentOf = (c: Continuity) => {
    const b = c.branchesFrom;
    if (!b || hidden.has(b.continuityId)) return undefined;
    return entriesOf.get(b.continuityId)?.some((p) => p.title.id === b.afterTitleId) ? b : undefined;
  };

  const lanes: TimelineLane[] = [];
  const laneIndex = new Map<string, number>();

  const place = (c: Continuity, depth: number) => {
    const pairs = (entriesOf.get(c.id) ?? []).sort(byChrono);
    const parent = parentOf(c);
    let start = 0;
    let branch: TimelineLane["branch"];
    if (parent) {
      const lane = laneIndex.get(parent.continuityId)!;
      const from = lanes[lane]!.items.find((i) => i.title.id === parent.afterTitleId)!;
      branch = { lane, slot: from.slot };
      start = from.slot + 1;
    }
    if (pairs.length > 0) {
      laneIndex.set(c.id, lanes.length);
      lanes.push({ continuity: c, items: pairs.map((p, i) => ({ ...p, slot: start + i })), branch, depth });
    }
    // Las ramas van justo debajo de su origen, en el orden del catálogo.
    for (const child of visible) if (parentOf(child)?.continuityId === c.id) place(child, depth + 1);
  };

  for (const c of visible) if (!parentOf(c)) place(c, 0);

  const width = Math.max(0, ...lanes.flatMap((l) => l.items.map((i) => i.slot + 1)));
  return { lanes, width };
}
