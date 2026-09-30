import { useMemo, useState } from "react";
import { Link } from "react-router";
import { formatRuntime, Poster, SectionLabel, Tabs } from "../../components/ui";
import { useCatalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import type { OrderedItem } from "../../lib/orders";
import { pendingUnits, suggestForBudget } from "../../lib/planner";
import { todayIso } from "../../lib/progress";
import { useProgressStore } from "../../lib/progressStore";
import { useItemLabel } from "../planner/usePlan";

const BUDGETS = ["60", "120", "180", "240", "360"] as const;

/** "Tengo X horas" (SPEC §9.2): lo siguiente del orden activo que cabe en ese tiempo. */
export function TimeBudget({ items, planHref }: { items: readonly OrderedItem[]; planHref: string }) {
  const { t } = useLang();
  const index = useCatalogIndex();
  const progress = useProgressStore((s) => s.progress);
  const [budget, setBudget] = useState<(typeof BUDGETS)[number] | undefined>();
  const itemLabel = useItemLabel();

  const suggestion = useMemo(() => {
    if (!budget) return undefined;
    const units = pendingUnits(
      items.map(({ title, season }) => ({ title, season })),
      progress,
    );
    return suggestForBudget(units, Number(budget), todayIso());
  }, [budget, items, progress]);

  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>{t("budget.title")}</SectionLabel>
        <Link to={planHref} className="text-link font-mono text-[11px] uppercase">
          {t("budget.plan")}
        </Link>
      </div>
      <Tabs
        label={t("budget.title")}
        layout="grid grid-cols-5"
        value={budget}
        options={BUDGETS.map((b) => ({ value: b, label: t("budget.hours", { count: Number(b) / 60 }) }))}
        onChange={(b) => setBudget((current) => (current === b ? undefined : b))}
      />
      {suggestion && (
        <div className="border-2 border-t-0 border-line bg-surface p-3.5" aria-live="polite">
          {suggestion.items.length === 0 ? (
            <p className="text-sm text-fg-soft">
              {suggestion.next
                ? t("budget.tooLong", { title: itemLabel(suggestion.next), time: formatRuntime(suggestion.next.minutes, t) })
                : t("budget.nothing")}
            </p>
          ) : (
            <>
              <ol className="space-y-2">
                {suggestion.items.map((item) => {
                  const title = index.titlesById.get(item.titleId)!;
                  return (
                    <li key={`${item.titleId}-${item.season}-${item.from}`}>
                      <Link to={`/t/${title.id}`} className="group flex items-center gap-3">
                        <Poster title={title} size="w92" className="h-12 w-8" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                          {itemLabel(item)}
                        </span>
                        <span className="font-mono text-[11px] text-muted uppercase">{formatRuntime(item.minutes, t)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 border-t-2 border-line-soft pt-2 font-mono text-[11px] text-muted uppercase">
                {t("budget.total", { time: formatRuntime(suggestion.minutes, t) })}
                {suggestion.next && ` · ${t("budget.then", { title: itemLabel(suggestion.next) })}`}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
