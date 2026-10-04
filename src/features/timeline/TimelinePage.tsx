import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { Link, useParams } from "react-router";
import { accentStyle, Button, Chip, SectionLabel } from "../../components/ui";
import { useFranchiseView } from "../../hooks/useFranchiseView";
import { Missing } from "../../components/Missing";
import { useLang } from "../../lib/i18n";
import { todayIso } from "../../lib/progress";
import { isUnitWatched, seasonOf, unitKey, unitReleaseDate } from "../../lib/units";
import { useProgressStore } from "../../lib/progressStore";
import { posterUrl } from "../../lib/tmdb";
import { buildTimeline, type TimelineItem } from "../../lib/timeline";
import { useSettings } from "../../lib/settings";

// Línea de tiempo (SPEC §9.3): eje horizontal in-universe, un carril por continuidad y las
// ramas dibujadas desde su punto de separación. Zoom, arrastre y tocar para abrir.

const ZOOMS = [36, 52, 76, 104] as const;
const GAP = 10;
const PAD = 16;
const LABEL_H = 30;
const LANE_GAP = 18;

export function TimelinePage() {
  const { franchiseId } = useParams();
  const view = useFranchiseView(franchiseId);
  const { t, loc } = useLang();
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const center = useRef<number | null>(null);
  const { franchise, hiddenContinuities } = view;

  const timeline = useMemo(
    () => (franchise ? buildTimeline(franchise, view.index.titlesById, hiddenContinuities) : undefined),
    [franchise, view.index, hiddenContinuities],
  );

  // Al cambiar el zoom, el centro de la vista se queda en el mismo punto de la línea.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || center.current === null) return;
    el.scrollLeft = center.current * el.scrollWidth - el.clientWidth / 2;
    center.current = null;
  }, [zoom]);

  const changeZoom = (delta: number) => {
    const el = scroller.current;
    if (el) center.current = (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth;
    setZoom((z) => Math.min(ZOOMS.length - 1, Math.max(0, z + delta)));
  };

  const drag = useDragScroll(scroller);

  if (!view.ready) return <p className="py-16 text-center text-muted">…</p>;
  if (!franchise || !timeline) return <Missing message={t("franchise.notFound")} />;

  const w = ZOOMS[zoom] ?? ZOOMS[1];
  const h = Math.round(w * 1.5);
  const laneH = LABEL_H + h + LANE_GAP;
  const x = (slot: number) => PAD + slot * (w + GAP);
  const y = (lane: number) => lane * laneH + LABEL_H;
  const contentW = x(timeline.width) + PAD;
  const contentH = timeline.lanes.length * laneH;

  return (
    <div style={accentStyle(franchise.accentColor)}>
      <header className="-mx-4 border-b-2 border-line bg-accent px-4 pt-5 pb-8 text-on-accent">
        <Link to={`/f/${franchise.id}`} className="label inline-block border-b-2 border-current pb-0.5 font-bold">
          ← {loc(franchise.name)}
        </Link>
        <h1 className="display mt-6 text-[39px]">{t("timeline.title")}</h1>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.55]">{t("timeline.intro")}</p>
      </header>

      <section className="mt-6">
        <SectionLabel>{t("franchise.continuities")}</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {franchise.continuities.map((c) => (
            <Chip key={c.id} selected={!hiddenContinuities.includes(c.id)} onClick={() => view.toggleContinuity(c.id)}>
              {loc(c.name)}
            </Chip>
          ))}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Legend />
        <div className="flex shrink-0 gap-1.5" role="group" aria-label={t("timeline.zoom")}>
          <Button className="!px-3.5" aria-label={t("timeline.zoomOut")} disabled={zoom === 0} onClick={() => changeZoom(-1)}>
            −
          </Button>
          <Button className="!px-3.5" aria-label={t("timeline.zoomIn")} disabled={zoom === ZOOMS.length - 1} onClick={() => changeZoom(1)}>
            +
          </Button>
        </div>
      </div>

      {timeline.lanes.length === 0 ? (
        <p className="py-12 text-center text-muted">{t("timeline.empty")}</p>
      ) : (
        <div
          ref={scroller}
          {...drag}
          tabIndex={0}
          aria-label={t("timeline.title")}
          className="-mx-4 mt-3 cursor-grab overflow-auto border-y-2 border-line bg-surface-muted select-none active:cursor-grabbing"
          style={{ maxHeight: "70dvh" }}
        >
          <div className="relative" style={{ width: contentW, height: contentH }}>
            <svg className="pointer-events-none absolute inset-0" width={contentW} height={contentH} aria-hidden>
              {timeline.lanes.map((lane, i) => {
                if (!lane.branch) return null;
                const x0 = x(lane.branch.slot) + w / 2;
                const y0 = y(lane.branch.lane) + h;
                const x1 = x(lane.items[0]!.slot);
                const y1 = y(i) + h / 2;
                return (
                  <path
                    key={lane.continuity.id}
                    d={`M${x0},${y0} V${y1} H${x1}`}
                    fill="none"
                    stroke="var(--color-fg)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                );
              })}
              {timeline.lanes.map((lane, i) => (
                <line
                  key={`axis-${lane.continuity.id}`}
                  x1={x(lane.items[0]!.slot)}
                  x2={x(lane.items.at(-1)!.slot) + w}
                  y1={y(i) + h / 2}
                  y2={y(i) + h / 2}
                  stroke="var(--color-line-soft)"
                  strokeWidth={2}
                />
              ))}
            </svg>

            {timeline.lanes.map((lane, i) => (
              <div key={lane.continuity.id}>
                <div
                  className="absolute z-[1] flex items-center gap-2 px-4"
                  style={{ top: i * laneH, left: Math.max(0, x(lane.items[0]!.slot) - PAD), height: LABEL_H }}
                >
                  <span className="label bg-surface-muted font-bold whitespace-nowrap">
                    {lane.depth > 0 && "↳ "}
                    {loc(lane.continuity.name)}
                  </span>
                  <span className="font-mono text-[10px] whitespace-nowrap text-muted uppercase">{t(`canon.${lane.continuity.canonLevel}`)}</span>
                </div>
                {lane.items.map((item) => (
                  <TimelineCard key={unitKey(item.title.id, item.entry.season)} item={item} left={x(item.slot)} top={y(i)} width={w} height={h} showName={zoom >= 2} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-fg-soft">{t("timeline.hint")}</p>
    </div>
  );
}

function Legend() {
  const { t } = useLang();
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted uppercase">
      <li className="flex items-center gap-1.5">
        <span className="size-3 border-2 border-line bg-accent" aria-hidden />
        {t("status.watched")}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 border-2 border-dashed border-line" aria-hidden />
        {t("timeline.upcoming")}
      </li>
    </ul>
  );
}

function TimelineCard({
  item,
  left,
  top,
  width,
  height,
  showName,
}: {
  item: TimelineItem;
  left: number;
  top: number;
  width: number;
  height: number;
  showName: boolean;
}) {
  const { t, unitName, loc } = useLang();
  const spoilerFree = useSettings((s) => s.spoilerFree);
  const season = item.entry.season;
  const watched = useProgressStore((s) =>
    isUnitWatched(s.progress[item.title.id], season, season === undefined ? undefined : seasonOf(item.title, season)?.episodes),
  );
  const released = unitReleaseDate(item.title, season) <= todayIso();
  const src = posterUrl(item.title.posterPath, width > 60 ? "w185" : "w92");
  const display = unitName(item.title, season);
  const note = item.entry.chronoNote ? loc(item.entry.chronoNote) : undefined;
  // Sin spoilers: lo no visto aparece difuminado.
  const blur = spoilerFree && !watched;

  return (
    <Link
      to={`/t/${item.title.id}`}
      title={[display, note].filter(Boolean).join(" · ")}
      aria-label={`${display}${watched ? ` · ${t("status.watched")}` : ""}${note ? ` · ${note}` : ""}`}
      draggable={false}
      className={`group absolute block overflow-hidden border-2 bg-surface focus-visible:z-10 ${
        watched ? "border-line outline-[3px] outline-offset-0 outline-accent" : released ? "border-line" : "border-dashed border-line"
      }`}
      style={{ left, top, width, height, outlineStyle: watched ? "solid" : undefined }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`size-full object-cover ${blur ? "scale-110 blur-[5px]" : ""} ${!released ? "opacity-60" : ""}`}
        />
      ) : (
        <span className="label grid size-full place-items-center p-1 text-center text-[8px] text-muted">{display}</span>
      )}
      {watched && (
        <span className="absolute top-0 right-0 grid size-4 place-items-center bg-accent text-on-accent" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={4}>
            <path d="M4.5 12.5l5 5L19.5 7" strokeLinecap="square" />
          </svg>
        </span>
      )}
      {showName && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-tinta/85 px-1 py-0.5 font-mono text-[9px] text-[color:var(--papel)] group-hover:whitespace-normal">
          {display}
        </span>
      )}
    </Link>
  );
}


/** Arrastrar con el mouse para desplazar; en pantallas táctiles, el scroll nativo. */
function useDragScroll(ref: RefObject<HTMLDivElement | null>) {
  const state = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
      state.current = { x: e.clientX, y: e.clientY, left: ref.current.scrollLeft, top: ref.current.scrollTop, moved: false };
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const s = state.current;
      if (!s || !ref.current) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.moved && Math.hypot(dx, dy) < 5) return;
      s.moved = true;
      ref.current.scrollLeft = s.left - dx;
      ref.current.scrollTop = s.top - dy;
    },
    onPointerUp: () => {
      // Deja el estado hasta el click: si hubo arrastre, el click no abre el título.
      setTimeout(() => (state.current = null));
    },
    onPointerLeave: () => {
      state.current = null;
    },
    onClickCapture: (e: ReactMouseEvent) => {
      if (state.current?.moved) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}
