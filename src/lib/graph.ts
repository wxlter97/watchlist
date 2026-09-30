import type { CatalogIndex } from "./catalogIndex";
import { parseUnitKey } from "./units";
import type { Franchise, LocalizedText } from "./types";

// Mapa de conexiones (SPEC §9.3): títulos unidos a sus personajes, equipos y continuidades
// (desde tags y entries). Con varias franquicias, cada título se une también a las
// franquicias donde aparece o a cuyas rutas pertenece: así salen a la luz los crossovers.

export type NodeKind = "title" | "character" | "team" | "continuity" | "franchise";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  /** Título: id del catálogo. Resto: nombre traducible. */
  titleId?: string;
  name?: LocalizedText;
  franchiseId?: string;
  /** Título que aparece en más de una de las franquicias mostradas. */
  crossover?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphOptions {
  franchiseIds: readonly string[];
  /** Continuidades ocultas por franquicia. */
  hiddenContinuities?: Readonly<Record<string, readonly string[]>>;
  characters?: boolean;
  teams?: boolean;
  continuities?: boolean;
}

export const titleNodeId = (titleId: string) => `t:${titleId}`;

export function buildGraph(index: CatalogIndex, options: GraphOptions): Graph {
  const { characters = true, teams = true, continuities = true } = options;
  const franchises = options.franchiseIds.flatMap((id) => index.franchisesById.get(id) ?? []);
  const multi = franchises.length > 1;
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const titleFranchises = new Map<string, Set<string>>();
  const visibleByFranchise = new Map<string, Set<string>>();

  const link = (source: string, target: string) => {
    const key = source < target ? `${source}|${target}` : `${target}|${source}`;
    if (!edges.has(key)) edges.set(key, { source, target });
  };
  const addTitle = (titleId: string, franchise: Franchise) => {
    const id = titleNodeId(titleId);
    if (!nodes.has(id)) nodes.set(id, { id, kind: "title", titleId });
    const set = titleFranchises.get(titleId) ?? new Set();
    set.add(franchise.id);
    titleFranchises.set(titleId, set);
    if (multi) link(id, `f:${franchise.id}`);
    return id;
  };

  for (const franchise of franchises) {
    const hidden = new Set(options.hiddenContinuities?.[franchise.id] ?? []);
    if (multi) nodes.set(`f:${franchise.id}`, { id: `f:${franchise.id}`, kind: "franchise", name: franchise.name, franchiseId: franchise.id });
    const tagName = (list: Franchise["tags"]["characters"], id: string) => list.find((t) => t.id === id)?.name ?? id;

    const visibleTitles = new Set<string>();
    visibleByFranchise.set(franchise.id, visibleTitles);
    for (const entry of franchise.entries) {
      if (hidden.has(entry.continuityId) || !index.titlesById.has(entry.titleId)) continue;
      visibleTitles.add(entry.titleId);
      const t = addTitle(entry.titleId, franchise);

      if (continuities) {
        const c = franchise.continuities.find((x) => x.id === entry.continuityId);
        const cid = `c:${franchise.id}:${entry.continuityId}`;
        if (c && !nodes.has(cid)) nodes.set(cid, { id: cid, kind: "continuity", name: c.name, franchiseId: franchise.id });
        link(t, cid);
      }
      if (characters) {
        for (const ch of entry.characters ?? []) {
          const id = `p:${franchise.id}:${ch}`;
          if (!nodes.has(id)) nodes.set(id, { id, kind: "character", name: tagName(franchise.tags.characters, ch), franchiseId: franchise.id });
          link(t, id);
        }
      }
      if (teams) {
        for (const tm of entry.teams ?? []) {
          const id = `g:${franchise.id}:${tm}`;
          if (!nodes.has(id)) nodes.set(id, { id, kind: "team", name: tagName(franchise.tags.teams, tm), franchiseId: franchise.id });
          link(t, id);
        }
      }
    }
  }

  // Rutas que traen títulos de otra franquicia mostrada (crossovers): el título se une a esta también.
  if (multi) {
    for (const franchise of franchises) {
      const own = visibleByFranchise.get(franchise.id)!;
      for (const route of franchise.routes) {
        for (const key of route.titleIds) {
          const id = parseUnitKey(key).titleId;
          if (!own.has(id) && nodes.has(titleNodeId(id))) addTitle(id, franchise);
        }
      }
    }
  }

  for (const [titleId, set] of titleFranchises) if (set.size > 1) nodes.get(titleNodeId(titleId))!.crossover = true;
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/** Vecinos de un nodo (para el panel de detalle y el resaltado). */
export function neighbors(graph: Graph, nodeId: string): string[] {
  const out: string[] = [];
  for (const e of graph.edges) {
    if (e.source === nodeId) out.push(e.target);
    else if (e.target === nodeId) out.push(e.source);
  }
  return out;
}
