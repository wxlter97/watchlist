import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { accentStyle, Button, Chip, SectionLabel, SelectField, TextField } from "../../components/ui";
import { franchiseMetaById, useCatalog } from "../../lib/catalog";
import type { CatalogIndex } from "../../lib/catalogIndex";
import { effectiveHidden } from "../../lib/filters";
import { buildGraph, neighbors, type Graph, type GraphNode, type NodeKind } from "../../lib/graph";
import { useLang } from "../../lib/i18n";
import { useProgressStore } from "../../lib/progressStore";
import { normalize } from "../../lib/search";

// Mapa de conexiones (SPEC §9.3): grafo de títulos, personajes, equipos y continuidades.
// El layout de fuerzas se calcula una vez por filtro; después es un SVG con zoom y arrastre.
// La lista de conexiones del nodo elegido es la alternativa accesible al dibujo.

type SimNode = SimulationNodeDatum & GraphNode;
type Positions = Map<string, { x: number; y: number }>;

const RADIUS: Record<NodeKind, number> = { title: 5, character: 9, team: 9, continuity: 11, franchise: 16 };
const ALL = "all";

function layout(graph: Graph): Positions {
  const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
  const links = graph.edges.map((e) => ({ ...e }));
  const sim = forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, (typeof links)[number] & { source: string | SimNode; target: string | SimNode }>(links)
        .id((d) => d.id)
        .distance(40)
        .strength(0.35),
    )
    .force("charge", forceManyBody<SimNode>().strength((d) => (d.kind === "title" ? -45 : -320)))
    .force("collide", forceCollide<SimNode>((d) => RADIUS[d.kind] + 3))
    .force("x", forceX(0).strength(0.08))
    .force("y", forceY(0).strength(0.08))
    .stop();
  // Número fijo de pasos: mismo resultado en cada visita con los mismos filtros.
  for (let i = 0; i < 260; i++) sim.tick();
  return new Map(nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
}

// El mapa cruza franquicias (y "Todas"): se carga el catálogo entero.
export function GraphPage() {
  const { index, ready } = useCatalog("all");
  if (!ready) return <p className="py-16 text-center text-muted">…</p>;
  return <GraphView index={index} />;
}

function GraphView({ index }: { index: CatalogIndex }) {
  const { t, lang, loc, name } = useLang();
  const [params, setParams] = useSearchParams();
  const franchiseState = useProgressStore((s) => s.franchiseState);
  const progress = useProgressStore((s) => s.progress);
  const franchises = [...index.franchisesById.values()];
  const selectedFranchise = index.franchisesById.get(params.get("f") ?? "")?.id ?? (params.get("f") === ALL ? ALL : franchises[0]!.id);
  const [kinds, setKinds] = useState({ characters: true, teams: true, continuities: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string } | null>(null);
  const [query, setQuery] = useState("");

  // Continuidades: parte de las visibles del perfil; los cambios aquí son solo del mapa.
  const [overrides, setOverrides] = useState<Record<string, string[]>>({});
  const franchiseIds = selectedFranchise === ALL ? franchises.map((f) => f.id) : [selectedFranchise];
  const hiddenFor = (id: string) => {
    if (overrides[id]) return overrides[id];
    const s = franchiseState[id];
    return effectiveHidden(index.franchisesById.get(id)!, s?.hiddenContinuities, s?.shownContinuities);
  };
  const hiddenKey = JSON.stringify(franchiseIds.map((id) => [id, hiddenFor(id)]));
  const toggleContinuity = (franchiseId: string, continuityId: string) => {
    const hidden = hiddenFor(franchiseId);
    setOverrides((o) => ({
      ...o,
      [franchiseId]: hidden.includes(continuityId) ? hidden.filter((c) => c !== continuityId) : [...hidden, continuityId],
    }));
  };

  const graph = useMemo(() => {
    const entries = JSON.parse(hiddenKey) as [string, string[]][];
    return buildGraph(index, { franchiseIds: entries.map(([id]) => id), hiddenContinuities: Object.fromEntries(entries), ...kinds });
  }, [index, hiddenKey, kinds]);
  const positions = useMemo(() => layout(graph), [graph]);

  const labelOf = (node: GraphNode) => {
    if (node.titleId) {
      const title = index.titlesById.get(node.titleId);
      return title ? name(title) : node.titleId;
    }
    return loc(node.name);
  };
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const selectedNode = selected ? nodeById.get(selected) : undefined;
  const highlighted = useMemo(() => new Set(selected ? [selected, ...neighbors(graph, selected)] : []), [graph, selected]);

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return graph.nodes.filter((n) => normalize(labelOf(n)).includes(q)).slice(0, 8);
    // labelOf solo cambia con el idioma.
  }, [graph, query, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const accent = selectedFranchise === ALL ? "#FFDB00" : index.franchisesById.get(selectedFranchise)!.accentColor;

  return (
    <div style={accentStyle(accent)} className="pt-6">
      <h1 className="display text-[39px]">{t("graph.title")}</h1>
      <p className="mt-3 max-w-[58ch] leading-[1.55] text-fg-soft">{t("graph.intro")}</p>

      <section className="mt-6 space-y-3">
        <SelectField
          label={t("franchise.label")}
          value={selectedFranchise}
          options={[{ value: ALL, label: t("graph.allFranchises") }, ...franchises.map((f) => ({ value: f.id, label: loc(f.name) }))]}
          onChange={(e) => {
            setSelected(null);
            setFocus(null);
            setParams({ f: e.target.value }, { replace: true });
          }}
        />
        <div>
          <SectionLabel>{t("graph.show")}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {(["characters", "teams", "continuities"] as const).map((k) => (
              <Chip key={k} selected={kinds[k]} onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}>
                {t(`graph.kinds.${k}`)}
              </Chip>
            ))}
          </div>
        </div>
        {selectedFranchise !== ALL && (
          <div>
            <SectionLabel>{t("franchise.continuities")}</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {index.franchisesById.get(selectedFranchise)!.continuities.map((c) => (
                <Chip key={c.id} selected={!hiddenFor(selectedFranchise).includes(c.id)} onClick={() => toggleContinuity(selectedFranchise, c.id)}>
                  {loc(c.name)}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-fg-soft">{t("graph.continuitiesHint")}</p>
      </section>

      <GraphCanvas
        graph={graph}
        positions={positions}
        selected={selected}
        highlighted={highlighted}
        watched={(titleId) => progress[titleId]?.status === "watched"}
        labelOf={labelOf}
        onSelect={setSelected}
        focus={focus}
      />
      <Legend />

      <section className="mt-6">
        <TextField
          label={t("graph.find")}
          type="search"
          value={query}
          placeholder={t("graph.findPlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches.length > 0 && (
          <ul className="mt-2 border-2 border-line bg-surface">
            {matches.map((n) => (
              <li key={n.id} className="border-b-2 border-line-soft last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-fg hover:text-bg"
                  onClick={() => {
                    setSelected(n.id);
                    setFocus({ id: n.id });
                    setQuery("");
                  }}
                >
                  <span className="truncate font-semibold">{labelOf(n)}</span>
                  <span className="font-mono text-[10px] uppercase">{t(`graph.kind.${n.kind}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedNode && (
        <NodePanel
          node={selectedNode}
          related={neighbors(graph, selectedNode.id).flatMap((id) => nodeById.get(id) ?? [])}
          labelOf={labelOf}
          onSelect={(id) => {
            setSelected(id);
            setFocus({ id });
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Legend() {
  const { t } = useLang();
  const items: { kind: NodeKind; className: string }[] = [
    { kind: "title", className: "rounded-full bg-surface border-line" },
    { kind: "character", className: "bg-accent border-line" },
    { kind: "team", className: "rotate-45 bg-accent border-line" },
    { kind: "continuity", className: "bg-fg border-line" },
  ];
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted uppercase">
      {items.map((i) => (
        <li key={i.kind} className="flex items-center gap-1.5">
          <span className={`inline-block size-3 border-2 ${i.className}`} aria-hidden />
          {t(`graph.kind.${i.kind}`)}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-full border-2 border-line bg-fg" aria-hidden />
        {t("status.watched")}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-full border-[3px] border-alerta bg-surface" aria-hidden />
        {t("graph.crossover")}
      </li>
    </ul>
  );
}

function GraphCanvas({
  graph,
  positions,
  selected,
  highlighted,
  watched,
  labelOf,
  onSelect,
  focus,
}: {
  focus: { id: string } | null;
  graph: Graph;
  positions: Positions;
  selected: string | null;
  highlighted: Set<string>;
  watched: (titleId: string) => boolean;
  labelOf: (node: GraphNode) => string;
  onSelect: (id: string | null) => void;
}) {
  const { t } = useLang();
  const svg = useRef<SVGSVGElement>(null);
  const bounds = useMemo(() => {
    const xs = [...positions.values()].map((p) => p.x);
    const ys = [...positions.values()].map((p) => p.y);
    const pad = 40;
    const minX = Math.min(0, ...xs) - pad;
    const minY = Math.min(0, ...ys) - pad;
    return { minX, minY, w: Math.max(...xs, 0) + pad - minX, h: Math.max(...ys, 0) + pad - minY };
  }, [positions]);
  const [viewBox, setViewBox] = useState(bounds);
  useEffect(() => setViewBox(bounds), [bounds]);
  // Elegido desde el buscador: acerca la vista al nodo.
  useEffect(() => {
    const p = focus && positions.get(focus.id);
    if (!p) return;
    const w = Math.min(bounds.w, 320);
    const h = (w / bounds.w) * bounds.h;
    setViewBox({ minX: p.x - w / 2, minY: p.y - h / 2, w, h });
    svg.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus, positions, bounds]);

  // Arrastre (mouse, pluma o un dedo) y pellizco (dos dedos) sobre el viewBox.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);

  const toSvgScale = () => viewBox.w / (svg.current?.clientWidth || 1);
  const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
    setViewBox((v) => {
      const rect = svg.current?.getBoundingClientRect();
      const fx = rect && clientX !== undefined ? (clientX - rect.left) / rect.width : 0.5;
      const fy = rect && clientY !== undefined ? (clientY - rect.top) / rect.height : 0.5;
      const w = Math.min(bounds.w * 2, Math.max(bounds.w / 12, v.w * factor));
      const h = (w / v.w) * v.h;
      return { minX: v.minX + (v.w - w) * fx, minY: v.minY + (v.h - h) * fy, w, h };
    });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.entries()];
      const other = a![0] === e.pointerId ? b![1] : a![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0 && after > 0) zoomAt(before / after, (next.x + other.x) / 2, (next.y + other.y) / 2);
      moved.current = true;
    } else {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      if (!moved.current && Math.hypot(dx, dy) < 4) return;
      if (!moved.current) (e.currentTarget as Element).setPointerCapture(e.pointerId);
      moved.current = true;
      const k = toSvgScale();
      setViewBox((v) => ({ ...v, minX: v.minX - dx * k, minY: v.minY - dy * k }));
    }
    pointers.current.set(e.pointerId, next);
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
  };
  // Ctrl/⌘ + rueda (y el pellizco del trackpad) hacen zoom; la rueda sola sigue desplazando la página.
  // Listener nativo: el de React es pasivo y no puede cancelar el zoom del navegador.
  const zoomRef = useRef(zoomAt);
  zoomRef.current = zoomAt;
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: globalThis.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomRef.current(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Etiquetas de títulos solo si hay zoom suficiente o si están resaltados: el resto sería ruido.
  const showTitleLabels = viewBox.w < bounds.w / 2.5;
  const dim = selected !== null;

  return (
    <div className="-mx-4 mt-4 border-y-2 border-line bg-surface">
      <div className="flex items-center justify-end gap-1.5 border-b-2 border-line-soft px-4 py-2">
        <span className="mr-auto font-mono text-[10px] text-muted uppercase">
          {t("graph.counts", { nodes: graph.nodes.length, edges: graph.edges.length })}
        </span>
        <Button className="!min-h-9 !px-3 !py-1" aria-label={t("timeline.zoomOut")} onClick={() => zoomAt(1.3)}>
          −
        </Button>
        <Button className="!min-h-9 !px-3 !py-1" aria-label={t("timeline.zoomIn")} onClick={() => zoomAt(1 / 1.3)}>
          +
        </Button>
        <Button className="!min-h-9 !px-3 !py-1" onClick={() => setViewBox(bounds)}>
          {t("graph.reset")}
        </Button>
      </div>
      <svg
        ref={svg}
        role="img"
        aria-label={t("graph.svgLabel")}
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.w} ${viewBox.h}`}
        className="block h-[62dvh] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          if (!moved.current && e.target === e.currentTarget) onSelect(null);
        }}
      >
        <g stroke="var(--color-line-soft)" strokeWidth={1}>
          {graph.edges.map((edge) => {
            const a = positions.get(edge.source)!;
            const b = positions.get(edge.target)!;
            const on = dim && (edge.source === selected || edge.target === selected);
            return (
              <line
                key={`${edge.source}|${edge.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={on ? "var(--color-fg)" : undefined}
                strokeWidth={on ? 2 : 1}
                opacity={dim && !on ? 0.25 : 1}
              />
            );
          })}
        </g>
        {graph.nodes.map((node) => {
          const p = positions.get(node.id)!;
          const r = RADIUS[node.kind];
          const faded = dim && !highlighted.has(node.id);
          const isWatched = node.titleId ? watched(node.titleId) : false;
          const showLabel = node.kind !== "title" || showTitleLabels || (dim && highlighted.has(node.id));
          return (
            <g
              key={node.id}
              transform={`translate(${p.x},${p.y})`}
              opacity={faded ? 0.2 : 1}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (!moved.current) onSelect(node.id === selected ? null : node.id);
              }}
            >
              <title>{labelOf(node)}</title>
              <NodeShape node={node} r={r} watched={isWatched} selected={node.id === selected} />
              {showLabel && (
                <text
                  y={r + 9}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={node.kind === "title" ? 7 : 9}
                  fontWeight={node.kind === "title" ? 400 : 700}
                  fill="var(--color-fg)"
                  stroke="var(--color-surface)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {labelOf(node)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function NodeShape({ node, r, watched, selected }: { node: GraphNode; r: number; watched: boolean; selected: boolean }) {
  const stroke = selected ? "var(--color-alerta)" : "var(--color-line)";
  const sw = selected ? 3 : 2;
  switch (node.kind) {
    case "title":
      return (
        <circle
          r={r}
          fill={watched ? "var(--color-fg)" : "var(--color-surface)"}
          stroke={node.crossover && !selected ? "var(--color-alerta)" : stroke}
          strokeWidth={node.crossover ? 3 : sw}
        />
      );
    case "character":
      return <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="var(--accent)" stroke={stroke} strokeWidth={sw} />;
    case "team":
      return <rect x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" fill="var(--accent)" stroke={stroke} strokeWidth={sw} />;
    case "continuity":
      return <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="var(--color-fg)" stroke={stroke} strokeWidth={sw} />;
    case "franchise": {
      const f = node.franchiseId ? franchiseMetaById.get(node.franchiseId) : undefined;
      return <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={f?.accentColor ?? "var(--accent)"} stroke={stroke} strokeWidth={3} />;
    }
  }
}

function NodePanel({
  node,
  related,
  labelOf,
  onSelect,
  onClose,
}: {
  node: GraphNode;
  related: GraphNode[];
  labelOf: (n: GraphNode) => string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const sorted = [...related].sort((a, b) => a.kind.localeCompare(b.kind) || labelOf(a).localeCompare(labelOf(b)));
  return (
    <section className="mt-6 border-2 border-line bg-surface" aria-live="polite">
      <div className="flex items-start justify-between gap-3 border-b-2 border-line bg-faro px-3.5 py-2.5 text-tinta">
        <div className="min-w-0">
          <p className="label font-bold">{t(`graph.kind.${node.kind}`)}</p>
          <p className="display truncate text-[22px]">{labelOf(node)}</p>
        </div>
        <button type="button" onClick={onClose} className="label shrink-0 border-2 border-tinta px-2 py-1 font-bold hover:bg-tinta hover:text-faro">
          {t("common.close")}
        </button>
      </div>
      <div className="p-3.5">
        {node.titleId && (
          <Link to={`/t/${node.titleId}`} className="text-link mb-3 inline-block uppercase">
            {t("graph.openTitle")}
          </Link>
        )}
        {node.kind === "franchise" && node.franchiseId && (
          <Link to={`/f/${node.franchiseId}`} className="text-link mb-3 inline-block uppercase">
            {t("hub.open")}
          </Link>
        )}
        <SectionLabel>{t("graph.connections", { count: related.length })}</SectionLabel>
        <ul className="flex flex-wrap gap-1.5">
          {sorted.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelect(n.id)}
                className="border-2 border-line-soft px-2 py-1 text-left text-sm hover:border-line hover:bg-fg hover:text-bg"
              >
                {labelOf(n)}
                {n.crossover && <span className="ml-1.5 font-mono text-[10px] text-alerta uppercase">{t("graph.crossover")}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
