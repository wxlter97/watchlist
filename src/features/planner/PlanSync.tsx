import { useEffect } from "react";
import { catalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { computePlan, sameSchedule } from "../../lib/plans";
import { usePlansStore } from "../../lib/plansStore";
import { todayIso } from "../../lib/progress";
import { useProgressStore } from "../../lib/progressStore";
import { useSession } from "../../lib/session";

/**
 * Mantiene al día el `schedule` guardado de los planes con feed suscribible: el servidor
 * arma el .ics desde ahí. Se recalcula al marcar vistos o al pasar los días (SPEC §9.2).
 */
export function PlanSync() {
  const { lang } = useLang();
  const ready = useSession((s) => s.status === "signedIn" && s.profileReady);
  const plans = usePlansStore((s) => s.plans);
  const progress = useProgressStore((s) => s.progress);
  const franchiseState = useProgressStore((s) => s.franchiseState);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const today = todayIso();
      for (const plan of Object.values(plans)) {
        if (!plan.feedToken) continue;
        const days = computePlan(plan, { index: catalogIndex, progress, franchiseState }, today).schedule.days;
        if (plan.lang !== lang || !sameSchedule(days, plan.schedule)) {
          usePlansStore.getState().savePlan({ ...plan, schedule: days, lang });
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [ready, plans, progress, franchiseState, lang]);

  return null;
}
