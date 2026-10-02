import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { accentStyle, Button, Chip, formatRuntime, Notice, SectionLabel, SelectField, Tabs, TextField, Toggle } from "../../components/ui";
import { franchiseMetaById, franchiseMetas, loadFranchises, useCatalog, withReferences } from "../../lib/catalog";
import type { CatalogIndex } from "../../lib/catalogIndex";
import { useLang } from "../../lib/i18n";
import { computeOrder, CUSTOM_ORDER_ID, resolveOrder } from "../../lib/orders";
import { isPrepLevel, PREP_LEVELS, prepUnits } from "../../lib/prep";
import type { Franchise, Title } from "../../lib/types";
import { addDays, WEEKDAYS, type Weekday } from "../../lib/planner";
import type { GoalType, PlanDoc, PlanGoal } from "../../lib/plans";
import { newPlanId, usePlansStore } from "../../lib/plansStore";
import { todayIso } from "../../lib/progress";
import { useProgressStore } from "../../lib/progressStore";
import { useGoalLabel, usePlanView } from "./usePlan";

const DEFAULT_DAYS: Weekday[] = ["fri", "sat", "sun"];

/** Franquicia de la meta inicial: la de la URL (?f=marvel) o la primera. */
function initialFranchiseId(params: URLSearchParams): string {
  const id = params.get("f") ?? "";
  return franchiseMetaById.has(id) ? id : franchiseMetas[0]!.id;
}

/** Meta inicial desde la URL (?f=marvel&type=route&ref=spider-man) o la primera franquicia. */
function initialGoal(params: URLSearchParams, index: CatalogIndex): PlanGoal {
  const franchise = index.franchisesById.get(initialFranchiseId(params))!;
  const type = (["franchise", "order", "route", "prep"] as const).find((t) => t === params.get("type")) ?? "franchise";
  const ref = params.get("ref") ?? "";
  if (type === "prep" && franchise.entries.some((e) => e.titleId === ref)) {
    const level = params.get("level");
    return { type, franchiseId: franchise.id, refId: ref, level: isPrepLevel(level) ? level : "recommended" };
  }
  if (type === "route" && franchise.routes.some((r) => r.id === ref)) return { type, franchiseId: franchise.id, refId: ref };
  if (type === "order" && (ref === CUSTOM_ORDER_ID || franchise.orders.some((o) => o.id === ref))) {
    return { type, franchiseId: franchise.id, refId: ref };
  }
  return { type: "franchise", franchiseId: franchise.id, refId: franchise.id };
}

/** Para "Prepárate para…": terminar el día antes del estreno. */
function prepDeadline(goal: PlanGoal, today: string, index: CatalogIndex): string | undefined {
  let target: Title | undefined;
  if (goal.type === "prep") target = index.titlesById.get(goal.refId);
  else if (goal.type === "route") {
    const route = index.franchisesById.get(goal.franchiseId)?.routes.find((r) => r.id === goal.refId);
    target = route?.targetTitleId ? index.titlesById.get(route.targetTitleId) : undefined;
  }
  if (!target || target.releaseDate <= today) return undefined;
  return addDays(target.releaseDate, -1);
}

/** Títulos de la franquicia con algo antes en el cronológico, en ese orden (sin repetir series). */
function prepTargetsOf(franchise: Franchise, index: CatalogIndex): Title[] {
  const chrono = franchise.orders.find((o) => o.type === "chronological")?.id;
  const titles = computeOrder(franchise, resolveOrder(franchise, chrono), index.titlesById).map((i) => i.title);
  return [...new Map(titles.map((t) => [t.id, t])).values()].filter((t) => prepUnits(franchise, t.id, "all", index).length > 0);
}

export function PlanEditor() {
  const { planId } = useParams();
  const [params] = useSearchParams();
  const existing = usePlansStore((s) => (planId ? s.plans[planId] : undefined));
  // El formulario arranca con la franquicia de la meta ya cargada.
  const { ready } = useCatalog(withReferences(existing?.goal.franchiseId ?? initialFranchiseId(params)));
  if (planId && !existing) return <PlanMissing />;
  if (!ready) return <p className="py-16 text-center text-muted">…</p>;
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
  const { t, lang, loc, date, name: titleLabel } = useLang();
  const navigate = useNavigate();
  const savePlan = usePlansStore((s) => s.savePlan);
  const goalLabel = useGoalLabel();
  const today = todayIso();
  // La franquicia de la meta siempre está cargada: PlanEditor espera la inicial y cambiar de
  // franquicia la carga antes de elegirla.
  const { index } = useCatalog(withReferences(existing?.goal.franchiseId ?? initialFranchiseId(params)));

  const [goal, setGoal] = useState<PlanGoal>(() => existing?.goal ?? initialGoal(params, index));
  const [essentialOnly, setEssentialOnly] = useState(existing?.essentialOnly ?? false);
  const [weeklyHours, setWeeklyHours] = useState(String(existing?.weeklyHours ?? 6));
  const [availableDays, setAvailableDays] = useState<Weekday[]>(existing?.availableDays ?? DEFAULT_DAYS);
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [deadline, setDeadline] = useState(existing?.deadline ?? prepDeadline(goal, today, index) ?? "");
  const [startTime, setStartTime] = useState(existing?.startTime ?? "20:00");
  const [name, setName] = useState(existing?.name ?? "");

  const franchise = index.franchisesById.get(goal.franchiseId)!;
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

  // Títulos que se pueden preparar: los del cronológico que tienen algo antes, el más próximo a estrenarse primero elegido.
  const prepTargets = useMemo(() => prepTargetsOf(franchise, index), [franchise, index]);
  const setGoalType = (type: GoalType) => {
    if (type === "prep") {
      const upcoming = prepTargets.find((t) => t.releaseDate >= today) ?? prepTargets.at(-1);
      if (!upcoming) return;
      return changeGoal({ type, franchiseId: franchise.id, refId: upcoming.id, level: "recommended" });
    }
    const refId = type === "route" ? (franchise.routes[0]?.id ?? "") : type === "order" ? franchise.orders[0]!.id : franchise.id;
    if (type === "route" && !refId) return;
    changeGoal({ type, franchiseId: franchise.id, refId });
  };
  const changeGoal = (next: PlanGoal) => {
    setGoal(next);
    const prep = prepDeadline(next, today, index);
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
    <form onSubmit={submit} className="max-w-3xl space-y-8 pt-6" style={accentStyle(franchise.accentColor)}>
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
          options={franchiseMetas.map((f) => ({ value: f.id, label: loc(f.name) }))}
          onChange={(e) => {
            const id = e.target.value;
            void loadFranchises(withReferences(id)).then(() => changeGoal({ type: "franchise", franchiseId: id, refId: id }));
          }}
        />
        <Tabs
          label={t("planner.goalType")}
          layout="grid grid-cols-2 sm:grid-cols-4"
          value={goal.type}
          options={[
            { value: "franchise", label: t("planner.goalTypes.franchise") },
            { value: "order", label: t("planner.goalTypes.order") },
            { value: "route", label: t("planner.goalTypes.route"), disabled: franchise.routes.length === 0 },
            { value: "prep", label: t("planner.goalTypes.prep"), disabled: prepTargets.length === 0 },
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
        {goal.type === "prep" && (
          <>
            <SelectField
              label={t("prep.target")}
              value={goal.refId}
              options={prepTargets.map((x) => ({ value: x.id, label: titleLabel(x) }))}
              onChange={(e) => changeGoal({ ...goal, refId: e.target.value })}
            />
            <Tabs
              label={t("prep.level")}
              layout="grid grid-cols-3"
              value={goal.level ?? "recommended"}
              options={PREP_LEVELS.map((l) => ({ value: l, label: t(`prep.levels.${l}`) }))}
              onChange={(level) => changeGoal({ ...goal, level })}
            />
          </>
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
