import { lazy, Suspense, useState } from "react";
import { Link, useParams } from "react-router";
import { FollowButton } from "../../components/FollowButton";
import { TitleRow } from "../../components/TitleRow";
import { accentStyle, Button, ProgressBar, SectionLabel, Tabs } from "../../components/ui";
import { useFranchiseView } from "../../hooks/useFranchiseView";
import { useLang } from "../../lib/i18n";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { CUSTOM_ORDER_ID, watchedUpTo, type OrderedItem } from "../../lib/orders";
import { useProgressStore } from "../../lib/progressStore";
import { showToast } from "../../lib/toasts";
import { markUnitsWatched } from "../../lib/actions";
import { unitKey, type IsWatched } from "../../lib/units";
import { summarize, todayIso } from "../../lib/progress";
import { RoutesSection } from "../routes/RoutesSection";
import { FiltersPanel } from "./FiltersPanel";
import { TimeBudget } from "./TimeBudget";
import { ShareButton } from "../../components/ShareButton";
import { ShareLinkButton } from "../../components/ShareLinkButton";
import { minutesWatched } from "../../lib/episodes";

// El editor trae @dnd-kit: solo se descarga al empezar a editar el orden.
const CustomOrderEditor = lazy(() => import("./CustomOrderEditor").then((m) => ({ default: m.CustomOrderEditor })));
import type { ProgressDoc } from "../../lib/progressStore";
import type { Franchise, Title } from "../../lib/types";

export function FranchisePage() {
  const { franchiseId } = useParams();
  const view = useFranchiseView(franchiseId);
  const { t, loc, unitName } = useLang();
  const [editing, setEditing] = useState(false);
  const [upTo, setUpTo] = useState<{ key: string; items: OrderedItem[] } | null>(null);
  const applyMany = useProgressStore((s) => s.applyMany);
  const progress = useProgressStore((s) => s.progress);
  const { franchise, order, items, visibleItems, summary } = view;

  if (!view.ready) return <p className="py-16 text-center text-muted">…</p>;
  if (!franchise || !order) {
    return <p className="py-16 text-center text-muted">{t("franchise.notFound")}</p>;
  }

  const isCustom = order.type === "custom";

  // "Visto hasta aquí" usa el orden completo (sin filtros), no solo lo que se ve.
  const askWatchedUpTo = (key: string) => setUpTo({ key, items: watchedUpTo(items, key, view.isWatched, todayIso()) });
  const confirmWatchedUpTo = () => {
    if (!upTo?.items.length) return setUpTo(null);
    // Las temporadas marcan sus episodios; los títulos, el título entero.
    const before = markUnitsWatched(upTo.items);
    showToast({
      message: t("upTo.done", { count: upTo.items.length }),
      action: { label: t("upTo.undo"), onClick: () => applyMany(before) },
      duration: 10_000,
    });
    setUpTo(null);
  };
  const upToItem = upTo ? items.find((i) => i.key === upTo.key) : undefined;
  const sections = groupSections(visibleItems);
  const groupLabels = order.type === "grouped" ? order.groupLabels : undefined;
  const orderName = isCustom ? t("customOrder.name") : loc(order.name);
  const description = isCustom ? t("customOrder.description") : "description" in order ? loc(order.description) : "";

  return (
    <div style={accentStyle(franchise.accentColor)}>
      <header className="-mx-4 border-b-2 border-line bg-accent px-4 pt-5 pb-8 text-on-accent">
        <Link to="/" className="label inline-block border-b-2 border-current pb-0.5 font-bold">
          ← {t("nav.home")}
        </Link>
        <h1 className="display mt-6 text-[49px]">{loc(franchise.name)}</h1>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.55]">{loc(franchise.description)}</p>
        <div className="mt-5">
          <FollowButton franchiseId={franchise.id} />
        </div>
      </header>

      <section className="mt-6 border-2 border-line bg-surface p-4" aria-label={t("franchise.progress")}>
        <div className="flex items-end justify-between gap-4">
          <p className="display text-[39px] tabular-nums">{t("progress.percent", { value: Math.round(summary.ratio * 100) })}</p>
          <p className="text-right font-mono text-[11px] leading-relaxed tracking-[0.06em] text-muted uppercase">
            {t("progress.count", { watched: summary.watched, total: summary.total })}
            {summary.upcoming > 0 && (
              <>
                <br />
                {t("progress.upcoming", { count: summary.upcoming })}
              </>
            )}
          </p>
        </div>
        <div className="mt-3">
          <ProgressBar ratio={summary.ratio} label={loc(franchise.name)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <ShareLinkButton
            target={{ kind: "progress", franchiseId: franchise.id, refId: franchise.id }}
            title={t("shareLink.progressTitle", { name: loc(franchise.name) })}
            label={t("shareLink.progress")}
          />
          {view.hasCustomOrder && (
            <ShareLinkButton
              target={{ kind: "custom-order", franchiseId: franchise.id, refId: franchise.id }}
              title={t("shareLink.customOrderTitle", { name: loc(franchise.name) })}
              label={t("shareLink.customOrder")}
            />
          )}
        </div>
        {summary.total > 0 && summary.watched === summary.total && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t-2 border-line-soft pt-3">
            <p className="flex-1 text-sm font-semibold">{t("franchise.completed")}</p>
            <ShareButton
              card={{ kind: "franchise", id: franchise.id, n: summary.watched, h: Math.round(franchiseMinutes(franchise, view.index.titlesById, progress) / 60) }}
              title={loc(franchise.name)}
              text={t("franchise.shareText", { name: loc(franchise.name) })}
              fileName={`watch-order-${franchise.id}`}
            />
          </div>
        )}
      </section>

      <nav aria-label={t("franchise.views")} className="mt-3 grid grid-cols-2 gap-[2px] border-2 border-line bg-line">
        <Link
          to={`/f/${franchise.id}/timeline`}
          className="label bg-surface px-3 py-3 text-center font-bold transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
        >
          {t("timeline.title")}
        </Link>
        <Link
          to={`/map?f=${franchise.id}`}
          className="label bg-surface px-3 py-3 text-center font-bold transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
        >
          {t("graph.title")}
        </Link>
      </nav>

      <section className="mt-6">
        <SectionLabel>{t("franchise.order")}</SectionLabel>
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4">
          <Tabs
            label={t("franchise.order")}
            layout="flex w-max min-w-full"
            value={order.id}
            options={[
              ...franchise.orders.map((o) => ({ value: o.id, label: loc(o.name) })),
              { value: CUSTOM_ORDER_ID, label: t("customOrder.name") },
            ]}
            onChange={(id) => {
              setEditing(false);
              view.setOrder(id);
            }}
          />
        </div>
        {description && <p className="mt-2 max-w-[70ch] text-sm leading-[1.55] text-fg-soft">{description}</p>}
        {isCustom && !editing && (
          <div className="mt-3">
            <Button onClick={() => setEditing(true)}>{t(view.hasCustomOrder ? "customOrder.edit" : "customOrder.start")}</Button>
          </div>
        )}
      </section>

      {!editing && <TimeBudget items={items} planHref={`/plans/new?f=${franchise.id}&type=order&ref=${order.id}`} />}

      {editing ? (
        <Suspense fallback={<p className="py-8 text-center text-muted">…</p>}>
          <CustomOrderEditor
            units={items.map(({ key, title, season }) => ({ key, title, season }))}
            onCancel={() => setEditing(false)}
            onSave={(keys) => {
              // Lo de continuidades ocultas conserva su lugar relativo, al final.
              const rest = computeHiddenTail(view.items, keys, franchise.entries.map((e) => unitKey(e.titleId, e.season)));
              view.saveCustomOrder([...keys, ...rest]);
              setEditing(false);
            }}
          />
        </Suspense>
      ) : (
        <>
          <FiltersPanel
            franchise={franchise}
            filters={view.filters}
            hiddenContinuities={view.hiddenContinuities}
            onToggleContinuity={view.toggleContinuity}
            shown={visibleItems.length}
            total={items.length}
          />

          {visibleItems.length === 0 ? (
            <p className="py-12 text-center text-muted">{t("franchise.empty")}</p>
          ) : (
            sections.map((section, i) => (
              <section key={section.key ?? i} className="mt-8">
                {section.key && groupLabels?.[section.key] && (
                  <SectionHeader label={loc(groupLabels[section.key])} items={section.items} isWatched={view.isWatched} />
                )}
                <ol>
                  {section.items.map((item) => (
                    <TitleRow
                      key={item.key}
                      item={item}
                      showChronoNote={order.type === "chronological"}
                      onWatchedUpTo={askWatchedUpTo}
                    />
                  ))}
                </ol>
              </section>
            ))
          )}

          <RoutesSection franchise={franchise} />

          <ConfirmDialog
            open={Boolean(upTo)}
            title={t("upTo.title")}
            confirmLabel={t("upTo.confirm", { count: upTo?.items.length ?? 0 })}
            cancelLabel={t("common.cancel")}
            onCancel={() => setUpTo(null)}
            onConfirm={confirmWatchedUpTo}
          >
            {upTo && upToItem && (
              <p>
                {upTo.items.length
                  ? t("upTo.body", { count: upTo.items.length, title: unitName(upToItem.title, upToItem.season), order: orderName })
                  : t("upTo.nothing", { title: unitName(upToItem.title, upToItem.season) })}
              </p>
            )}
          </ConfirmDialog>
        </>
      )}
    </div>
  );
}

/** Minutos vistos de los títulos de la franquicia (cada título una vez). */
function franchiseMinutes(franchise: Franchise, titlesById: ReadonlyMap<string, Title>, progress: Record<string, ProgressDoc>): number {
  let total = 0;
  for (const id of new Set(franchise.entries.map((e) => e.titleId))) {
    const title = titlesById.get(id);
    if (title) total += minutesWatched(title, progress[id]);
  }
  return total;
}

/** Unidades de la franquicia que no estaban en el editor (continuidades ocultas). */
function computeHiddenTail(edited: OrderedItem[], savedIds: string[], allIds: string[]): string[] {
  const inEditor = new Set([...edited.map((i) => i.key), ...savedIds]);
  return allIds.filter((id) => !inEditor.has(id));
}

function SectionHeader({
  label,
  items,
  isWatched,
}: {
  label: string;
  items: OrderedItem[];
  isWatched: IsWatched;
}) {
  const { t } = useLang();
  const s = summarize(items, isWatched);
  return (
    <div className="sticky top-[58px] z-10 -mx-4 flex items-baseline justify-between border-b-[3px] border-line bg-bg px-4 pt-3 pb-2">
      <h3 className="display text-[25px]">{label}</h3>
      <span className="label text-muted tabular-nums">{t("progress.count", { watched: s.watched, total: s.total })}</span>
    </div>
  );
}

function groupSections(items: OrderedItem[]) {
  const sections: { key?: string; items: OrderedItem[] }[] = [];
  for (const item of items) {
    const last = sections.at(-1);
    if (last && last.key === item.section) last.items.push(item);
    else sections.push({ key: item.section, items: [item] });
  }
  return sections;
}
