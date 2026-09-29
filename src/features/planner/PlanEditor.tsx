import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { accentStyle, Button, Chip, formatRuntime, Notice, SectionLabel, SelectField, Tabs, TextField, Toggle } from "../../components/ui";
import { catalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { CUSTOM_ORDER_ID } from "../../lib/orders";
import { addDays, WEEKDAYS, type Weekday } from "../../lib/planner";
import type { GoalType, PlanDoc, PlanGoal } from "../../lib/plans";
import { newPlanId, usePlansStore } from "../../lib/plansStore";
import { todayIso } from "../../lib/progress";
import { useProgressStore } from "../../lib/progressStore";
import { useGoalLabel, usePlanView } from "./usePlan";

const DEFAULT_DAYS: Weekday[] = ["fri", "sat", "sun"];

/** Meta inicial desde la URL (?f=marvel&type=route&ref=spider-man) o la primera franquicia. */
function initialGoal(params: URLSearchParams): PlanGoal {
  const franchises = [...catalogIndex.franchisesById.values()];
  const franchise = catalogIndex.franchisesById.get(params.get("f") ?? "") ?? franchises[0]!;
  const type = (["franchise", "order", "route"] as const).find((t) => t === params.get("type")) ?? "franchise";
  const ref = params.get("ref") ?? "";
  if (type === "route" && franchise.routes.some((r) => r.id === ref)) return { type, franchiseId: franchise.id, refId: ref };
  if (type === "order" && (ref === CUSTOM_ORDER_ID || franchise.orders.some((o) => o.id === ref))) {
    return { type, franchiseId: franchise.id, refId: ref };
  }
  return { type: "franchise", franchiseId: franchise.id, refId: franchise.id };
}

/** Para "Prepárate para…": terminar el día antes del estreno. */
function prepDeadline(goal: PlanGoal, today: string): string | undefined {
  if (goal.type !== "route") return undefined;
  const route = catalogIndex.franchisesById.get(goal.franchiseId)?.routes.find((r) => r.id === goal.refId);
  const target = route?.targetTitleId ? catalogIndex.titlesById.get(route.targetTitleId) : undefined;
  if (!target || target.releaseDate <= today) return undefined;
  return addDays(target.releaseDate, -1);
}

export function PlanEditor() {
  const { planId } = useParams();
  const [params] = useSearchParams();
  const existing = usePlansStore((s) => (planId ? s.plans[planId] : undefined));
  if (planId && !existing) return <PlanMissing />;
  // key: al cargar el plan desde Firestore se reinicia el formulario con sus datos.
  return <PlanForm key={existing?.id ?? "new"} existing={existing} params={params} />;
}

export function PlanMissing() {
  const { t } = useLang();
  return (
    <div className="py-16 text-center">
      <p className="text-muted">{t("planner.notFound")}</p>
      <Link to="/plans" className="text-link mt-4 inline-block">
        {t("planner.title")}
      </Link>
    </div>
  );
}

function PlanForm({ existing, params }: { existing?: PlanDoc; params: URLSearchParams }) {
  const { t, lang, loc, date } = useLang();
  const navigate = useNavigate();
  const savePlan = usePlansStore((s) => s.savePlan);
  const goalLabel = useGoalLabel();
  const today = todayIso();

  const [goal, setGoal] = useState<PlanGoal>(() => existing?.goal ?? initialGoal(params));
  const [essentialOnly, setEssentialOnly] = useState(existing?.essentialOnly ?? false);
  const [weeklyHours, setWeeklyHours] = useState(String(existing?.weeklyHours ?? 6));
  const [availableDays, setAvailableDays] = useState<Weekday[]>(existing?.availableDays ?? DEFAULT_DAYS);
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [deadline, setDeadline] = useState(existing?.deadline ?? prepDeadline(goal, today) ?? "");
  const [startTime, setStartTime] = useState(existing?.startTime ?? "20:00");
  const [name, setName] = useState(existing?.name ?? "");

  const franchise = catalogIndex.franchisesById.get(goal.franchiseId)!;
  const hasCustomOrder = useProgressStore((s) => Boolean(s.franchiseState[goal.franchiseId]?.customOrder?.length));
  const hours = Number(weeklyHours);
  const validHours = Number.isFinite(hours) && hours >= 0.5 && hours <= 100;
  const draft = useMemo(
    () => ({
      goal,
      essentialOnly,
      startDate,
      deadline: deadline || undefined,
      weeklyHours: validHours ? hours : 0,
      availableDays,
    }),
    [goal, essentialOnly, startDate, deadline, validHours, hours, availableDays],
  );
  const view = usePlanView(draft);
  const valid = validHours && availableDays.length > 0 && Boolean(startDate) && (!deadline || deadline >= startDate);

  const setGoalType = (type: GoalType) => {
    const refId = type === "route" ? (franchise.routes[0]?.id ?? "") : type === "order" ? franchise.orders[0]!.id : franchise.id;
    if (type === "route" && !refId) return;
    changeGoal({ type, franchiseId: franchise.id, refId });
  };
  const changeGoal = (next: PlanGoal) => {
    setGoal(next);
    const prep = prepDeadline(next, today);
    if (prep) setDeadline(prep);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || !view) return;
    const now = new Date().toISOString();
    const id = existing?.id ?? newPlanId();
    savePlan({
      ...existing,
      id,
      name: name.trim() || goalLabel(goal),
      goal,
      essentialOnly: essentialOnly || undefined,
      startDate,
      deadline: deadline || undefined,
      weeklyHours: hours,
      availableDays: WEEKDAYS.filter((d) => availableDays.includes(d)),
      startTime,
      schedule: view.schedule.days,
      lang,
      calendarExported: existing?.calendarExported ?? false,
      createdAt: existing?.createdAt ?? now,
    });
    navigate(`/plans/${id}`, { replace: Boolean(existing) });
  };

  const orderOptions = [
    ...franchise.orders.map((o) => ({ value: o.id, label: loc(o.name) })),
    ...(hasCustomOrder ? [{ value: CUSTOM_ORDER_ID, label: t("customOrder.name") }] : []),
  ];

  return (
    <form onSubmit={submit} className="space-y-8 pt-6" style={accentStyle(franchise.accentColor)}>
      <div>
        <Link to={existing ? `/plans/${existing.id}` : "/plans"} className="label inline-block border-b-2 border-current pb-0.5 font-bold">
          ← {existing ? existing.name : t("planner.title")}
        </Link>
        <h1 className="display mt-4 text-[39px]">{t(existing ? "planner.edit" : "planner.new")}</h1>
      </div>

      <section className="space-y-4">
        <SectionLabel>{t("planner.goal")}</SectionLabel>
        <SelectField
          label={t("franchise.label")}
          value={franchise.id}
          options={[...catalogIndex.franchisesById.values()].map((f) => ({ value: f.id, label: loc(f.name) }))}
          onChange={(e) => changeGoal({ type: "franchise", franchiseId: e.target.value, refId: e.target.value })}
        />
        <Tabs
          label={t("planner.goalType")}
          layout="grid grid-cols-3"
          value={goal.type}
          options={[
            { value: "franchise", label: t("planner.goalTypes.franchise") },
            { value: "order", label: t("planner.goalTypes.order") },
            { value: "route", label: t("planner.goalTypes.route"), disabled: franchise.routes.length === 0 },
          ]}
          onChange={setGoalType}
        />
        {goal.type === "franchise" && <p className="text-sm text-fg-soft">{t("planner.franchiseHint")}</p>}
        {goal.type === "order" && (
          <SelectField
            label={t("franchise.order")}
            value={goal.refId}
            options={orderOptions}
            onChange={(e) => changeGoal({ ...goal, refId: e.target.value })}
          />
        )}
        {goal.type === "route" && (
          <SelectField
            label={t("routes.title")}
            value={goal.refId}
            options={franchise.routes.map((r) => ({ value: r.id, label: loc(r.name) }))}
            onChange={(e) => changeGoal({ ...goal, refId: e.target.value })}
          />
        )}
        <div className="flex items-center justify-between gap-4 border-2 border-line bg-surface p-3">
          <div>
            <p className="font-semibold">{t("planner.essentialOnly")}</p>
            <p className="mt-0.5 text-xs text-fg-soft">{t("planner.essentialOnlyHint")}</p>
          </div>
          <Toggle checked={essentialOnly} label={t("planner.essentialOnly")} onChange={setEssentialOnly} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionLabel>{t("planner.time")}</SectionLabel>
        <TextField
          label={t("planner.weeklyHours")}
          type="number"
          inputMode="decimal"
          min={0.5}
          max={100}
          step={0.5}
          value={weeklyHours}
          onChange={(e) => setWeeklyHours(e.target.value)}
        />
        <fieldset>
          <legend className="label mb-1.5 text-fg-soft">{t("planner.days")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <Chip
                key={d}
                selected={availableDays.includes(d)}
                onClick={() => setAvailableDays((days) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d]))}
              >
                {t(`planner.weekdays.${d}`)}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("planner.startDate")} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <TextField label={t("planner.startTime")} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value || "20:00")} />
        </div>
        <div>
          <TextField
            label={t("planner.deadline")}
            type="date"
            value={deadline}
            min={startDate}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-fg-soft">{t("planner.deadlineHint")}</p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionLabel>{t("planner.name")}</SectionLabel>
        <TextField label={t("account.name")} value={name} maxLength={60} placeholder={goalLabel(goal)} onChange={(e) => setName(e.target.value)} />
      </section>

      {view && valid && (
        <Notice tone={view.schedule.fitsDeadline === false ? "error" : "neutral"}>
          {view.pendingTitles === 0 ? (
            <p>{t("planner.allWatched")}</p>
          ) : (
            <>
              <p className="font-semibold">
                {t("planner.preview", {
                  count: view.pendingTitles,
                  time: formatRuntime(view.schedule.totalMinutes, t),
                  sessions: view.schedule.days.length,
                })}
              </p>
              {view.schedule.endDate && <p className="mt-1">{t("planner.endsOn", { date: date(view.schedule.endDate) })}</p>}
              {view.schedule.fitsDeadline === false && <p className="mt-1">{t("planner.lateDetail")}</p>}
            </>
          )}
        </Notice>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={!valid}>
          {t(existing ? "common.save" : "planner.create")}
        </Button>
        <Button onClick={() => navigate(-1)}>{t("common.cancel")}</Button>
      </div>
    </form>
  );
}
