import { useMemo } from "react";
import { catalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import type { PlanItem } from "../../lib/planner";
import { computePlan, type PlanDoc } from "../../lib/plans";
import { todayIso } from "../../lib/progress";
import { useProgressStore } from "../../lib/progressStore";

type PlanInput = Parameters<typeof computePlan>[0];

/** Calendario del plan recalculado con el progreso actual, desde hoy. */
export function usePlanView(plan: PlanInput | undefined) {
  const progress = useProgressStore((s) => s.progress);
  const franchiseState = useProgressStore((s) => s.franchiseState);
  return useMemo(
    () => (plan ? computePlan(plan, { index: catalogIndex, progress, franchiseState }, todayIso()) : undefined),
    [plan, progress, franchiseState],
  );
}

/** Texto de una sesión: "Loki · T1 E1–3". */
export function useItemLabel() {
  const { t, name } = useLang();
  return (item: PlanItem) => {
    const title = catalogIndex.titlesById.get(item.titleId);
    const base = title ? name(title) : item.titleId;
    if (item.season === undefined || item.from === undefined) return base;
    return `${base} · ${t(item.from === item.to ? "planner.episode" : "planner.episodes", { season: item.season, from: item.from, to: item.to })}`;
  };
}

/** Nombre de la meta para mostrar: "Marvel · Ruta esencial". */
export function useGoalLabel() {
  const { t, loc } = useLang();
  return (goal: PlanDoc["goal"]) => {
    const franchise = catalogIndex.franchisesById.get(goal.franchiseId);
    if (!franchise) return goal.refId;
    const fName = loc(franchise.name);
    if (goal.type === "route") {
      const route = franchise.routes.find((r) => r.id === goal.refId);
      return route ? loc(route.name) : fName;
    }
    if (goal.type === "order") {
      const order = franchise.orders.find((o) => o.id === goal.refId);
      return `${fName} · ${order ? loc(order.name) : t("customOrder.name")}`;
    }
    return fName;
  };
}

/** "vie 2 oct". */
export function useDayLabel() {
  const { t } = useLang();
  const fmt = new Intl.DateTimeFormat(t("meta.locale"), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return (iso: string) => fmt.format(new Date(`${iso}T00:00:00Z`));
}
