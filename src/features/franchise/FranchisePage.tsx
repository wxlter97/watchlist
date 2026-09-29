import { Link, useParams } from "react-router";
import { TitleRow } from "../../components/TitleRow";
import { accentStyle, ProgressBar, SectionLabel, Tabs } from "../../components/ui";
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
      <header className="-mx-4 border-b-2 border-line bg-accent px-4 pt-5 pb-8 text-on-accent">
        <Link to="/" className="label inline-block border-b-2 border-current pb-0.5 font-bold">
          ← {t("nav.home")}
        </Link>
        <h1 className="display mt-6 text-[49px]">{loc(franchise.name)}</h1>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.55]">{loc(franchise.description)}</p>
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
      </section>

      <section className="mt-6">
        <SectionLabel>{t("franchise.order")}</SectionLabel>
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4">
          <Tabs
            label={t("franchise.order")}
            layout="flex w-max min-w-full"
            value={order.id}
            options={franchise.orders.map((o) => ({ value: o.id, label: loc(o.name) }))}
            onChange={view.setOrder}
          />
        </div>
        {"description" in order && order.description && (
          <p className="mt-2 max-w-[70ch] text-sm leading-[1.55] text-fg-soft">{loc(order.description)}</p>
        )}
      </section>

      {franchise.continuities.length > 1 && (
        <section className="mt-6">
          <SectionLabel>{t("franchise.continuities")}</SectionLabel>
          <div className="flex flex-col gap-2">
            {franchise.continuities.map((c) => {
              const visible = !view.hiddenContinuities.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={visible}
                  onClick={() => view.toggleContinuity(c.id)}
                  className="flex min-h-11 items-center gap-3 border-2 border-line bg-surface px-3 py-2 text-left transition-colors duration-[120ms] ease-out hover:bg-surface-muted"
                >
                  <span
                    aria-hidden
                    className={`grid size-5 shrink-0 place-items-center border-2 border-line ${visible ? "bg-accent text-on-accent" : ""}`}
                  >
                    {visible && (
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={4}>
                        <path d="M4.5 12.5l5 5L19.5 7" strokeLinecap="square" />
                      </svg>
                    )}
                  </span>
                  <span className={`flex-1 text-sm font-semibold ${visible ? "" : "text-muted"}`}>{loc(c.name)}</span>
                  <span className="label text-muted">{t(`canon.${c.canonLevel}`)}</span>
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
          <section key={section.key ?? i} className="mt-8">
            {section.key && groupLabels?.[section.key] && (
              <SectionHeader label={loc(groupLabels[section.key])} items={section.items} isWatched={view.isWatched} />
            )}
            <ol>
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
