import { Link, useParams } from "react-router";
import { TitleRow } from "../../components/TitleRow";
import { accentStyle, ProgressBar } from "../../components/ui";
import { useFranchiseView } from "../../hooks/useFranchiseView";
import { useLang } from "../../lib/i18n";
import type { OrderedItem } from "../../lib/orders";
import { summarize } from "../../lib/progress";

export function FranchisePage() {
  const { franchiseId } = useParams();
  const view = useFranchiseView(franchiseId);
  const { t, loc } = useLang();
  const { franchise, order, items, summary } = view;

  if (!franchise || !order) {
    return <p className="py-16 text-center text-muted">{t("franchise.notFound")}</p>;
  }

  const sections = groupSections(items);
  const groupLabels = order.type === "grouped" ? order.groupLabels : undefined;

  return (
    <div style={accentStyle(franchise.accentColor)}>
      <header className="relative -mx-4 mb-4 overflow-hidden px-4 pt-2 pb-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(120% 90% at 0% 0%, var(--accent), transparent 60%)" }}
        />
        <div className="relative">
          <Link to="/" className="text-sm text-muted hover:text-ink">
            ← {t("nav.home")}
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{loc(franchise.name)}</h1>
          <p className="mt-1 text-sm text-muted">{loc(franchise.description)}</p>
          <div className="mt-4 flex items-baseline justify-between text-sm">
            <span className="tabular-nums">{t("progress.count", { watched: summary.watched, total: summary.total })}</span>
            <span className="text-xs text-muted">
              {summary.upcoming > 0 && t("progress.upcoming", { count: summary.upcoming })}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar ratio={summary.ratio} label={loc(franchise.name)} />
          </div>
        </div>
      </header>

      <section aria-labelledby="order-label" className="space-y-2">
        <h2 id="order-label" className="sr-only">
          {t("franchise.order")}
        </h2>
        <div role="radiogroup" aria-labelledby="order-label" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
          {franchise.orders.map((o) => {
            const active = o.id === order.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => view.setOrder(o.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-(--accent) text-white" : "bg-surface-2 text-muted hover:text-ink"
                }`}
              >
                {loc(o.name)}
              </button>
            );
          })}
        </div>
        {"description" in order && order.description && <p className="text-sm text-muted">{loc(order.description)}</p>}
      </section>

      {franchise.continuities.length > 1 && (
        <section aria-labelledby="continuities-label" className="mt-4">
          <h2 id="continuities-label" className="mb-2 text-xs font-semibold tracking-wide text-faint uppercase">
            {t("franchise.continuities")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {franchise.continuities.map((c) => {
              const visible = !view.hiddenContinuities.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={visible}
                  title={loc(c.description)}
                  onClick={() => view.toggleContinuity(c.id)}
                  className={`rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${
                    visible ? "border-(--accent)/60 bg-(--accent)/10 text-ink" : "border-line text-faint line-through"
                  }`}
                >
                  {loc(c.name)} <span className="text-xs text-muted no-underline">· {t(`canon.${c.canonLevel}`)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <p className="py-12 text-center text-muted">{t("franchise.empty")}</p>
      ) : (
        sections.map((section, i) => (
          <section key={section.key ?? i} className="mt-6">
            {section.key && groupLabels?.[section.key] && (
              <SectionHeader label={loc(groupLabels[section.key])} items={section.items} isWatched={view.isWatched} />
            )}
            <ol className="divide-y divide-white/5">
              {section.items.map((item) => (
                <TitleRow key={item.title.id} item={item} showChronoNote={order.type === "chronological"} />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

function SectionHeader({
  label,
  items,
  isWatched,
}: {
  label: string;
  items: OrderedItem[];
  isWatched: (id: string) => boolean;
}) {
  const { t } = useLang();
  const s = summarize(items, isWatched);
  return (
    <div className="sticky top-14 z-10 -mx-4 flex items-baseline justify-between bg-bg/90 px-4 py-2 backdrop-blur">
      <h3 className="font-semibold">{label}</h3>
      <span className="text-xs tabular-nums text-muted">{t("progress.count", { watched: s.watched, total: s.total })}</span>
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
