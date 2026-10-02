import { Link } from "react-router";
import { accentStyle, SectionLabel } from "../../components/ui";
import { franchiseMetaById } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import type { PlanDoc } from "../../lib/plans";
import { usePlansStore } from "../../lib/plansStore";
import { useDayLabel, useGoalLabel, usePlanView } from "./usePlan";

export function PlansPage() {
  const { t } = useLang();
  const plans = Object.values(usePlansStore((s) => s.plans)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="pt-6">
      <h1 className="display text-[39px]">{t("planner.title")}</h1>
      <p className="mt-3 max-w-[58ch] leading-[1.55] text-fg-soft">{t("planner.intro")}</p>
      <Link
        to="/plans/new"
        className="mt-5 inline-flex min-h-11 items-center border-2 border-tinta bg-faro px-5 py-2.5 text-[15px] font-bold text-tinta transition-colors duration-[120ms] ease-out hover:bg-tinta hover:text-faro"
      >
        {t("planner.new")}
      </Link>

      <section className="mt-10">
        <SectionLabel>{t("planner.yourPlans")}</SectionLabel>
        {plans.length === 0 ? (
          <p className="border-2 border-dashed border-line-soft p-6 text-center text-muted">{t("planner.none")}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanDoc }) {
  const { t, date } = useLang();
  const view = usePlanView(plan);
  const goalLabel = useGoalLabel();
  const dayLabel = useDayLabel();
  const franchise = franchiseMetaById.get(plan.goal.franchiseId);
  const next = view?.schedule.days[0];
  const done = view && view.pendingTitles === 0;

  return (
    <li style={franchise ? accentStyle(franchise.accentColor) : undefined}>
      <Link to={`/plans/${plan.id}`} className="group block border-2 border-line bg-surface">
        <div className="h-2 border-b-2 border-line bg-accent" />
        <div className="p-3.5">
          <p className="font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">{plan.name}</p>
          {goalLabel(plan.goal) !== plan.name && <p className="mt-0.5 font-mono text-[11px] text-muted uppercase">{goalLabel(plan.goal)}</p>}
          <p className="mt-2 text-sm text-fg-soft">
            {done
              ? t("planner.completed")
              : next
                ? t("planner.nextSession", { day: dayLabel(next.date) })
                : t("planner.nothingScheduled")}
            {view?.schedule.endDate && !done && ` · ${t("planner.endsOn", { date: date(view.schedule.endDate) })}`}
          </p>
          {view?.schedule.fitsDeadline === false && (
            <p className="mt-2 font-mono text-[11px] font-bold text-alerta uppercase">{t("planner.late")}</p>
          )}
        </div>
      </Link>
    </li>
  );
}
