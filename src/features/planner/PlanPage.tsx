import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { accentStyle, Button, formatRuntime, Notice, Poster, SectionLabel, WatchToggle } from "../../components/ui";
import { setTitleStatus } from "../../lib/actions";
import { catalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { buildIcs, googleCalendarLink, googleSubscribeLink, planEvents } from "../../lib/ics";
import { addDays, weekdayOf, type PlanDay } from "../../lib/planner";
import { newFeedToken, type PlanDoc } from "../../lib/plans";
import { usePlansStore } from "../../lib/plansStore";
import { useProgressStore } from "../../lib/progressStore";
import { useSession } from "../../lib/session";
import { showToast } from "../../lib/toasts";
import { PlanMissing } from "./PlanEditor";
import { useDayLabel, useGoalLabel, useItemLabel, usePlanView } from "./usePlan";

/** Semanas de lunes a domingo, para leer el calendario de un vistazo. */
function byWeek(days: readonly PlanDay[]) {
  const weeks: { monday: string; days: PlanDay[] }[] = [];
  for (const day of days) {
    const offset = (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).indexOf(weekdayOf(day.date));
    const monday = addDays(day.date, -offset);
    const last = weeks.at(-1);
    if (last?.monday === monday) last.days.push(day);
    else weeks.push({ monday, days: [day] });
  }
  return weeks;
}

export function PlanPage() {
  const { planId } = useParams();
  const plan = usePlansStore((s) => (planId ? s.plans[planId] : undefined));
  if (!plan) return <PlanMissing />;
  return <PlanDetail plan={plan} />;
}

function PlanDetail({ plan }: { plan: PlanDoc }) {
  const { t, date } = useLang();
  const navigate = useNavigate();
  const view = usePlanView(plan);
  const goalLabel = useGoalLabel();
  const { savePlan, deletePlan } = usePlansStore.getState();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const franchise = catalogIndex.franchisesById.get(plan.goal.franchiseId);
  if (!view) return null;
  const { schedule } = view;

  return (
    <div style={franchise ? accentStyle(franchise.accentColor) : undefined}>
      <header className="-mx-4 border-b-2 border-line bg-accent px-4 pt-5 pb-8 text-on-accent">
        <Link to="/plans" className="label inline-block border-b-2 border-current pb-0.5 font-bold">
          ← {t("planner.title")}
        </Link>
        <h1 className="display mt-6 text-[39px] [text-wrap:balance]">{plan.name}</h1>
        {goalLabel(plan.goal) !== plan.name && <p className="label mt-2 font-bold">{goalLabel(plan.goal)}</p>}
        <p className="mt-3 font-mono text-[12px] uppercase">
          {t("planner.summary", { hours: plan.weeklyHours, days: plan.availableDays.map((d) => t(`planner.weekdays.${d}`)).join(" ") })}
          {plan.essentialOnly && ` · ${t("planner.essentialOnly")}`}
        </p>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Stat label={t("planner.pending")} value={`${view.pendingTitles}/${view.totalTitles}`} />
        <Stat label={t("planner.remaining")} value={formatRuntime(schedule.totalMinutes, t)} />
        <Stat label={t("planner.end")} value={schedule.endDate ? date(schedule.endDate) : "—"} />
        <Stat label={t("planner.deadline")} value={plan.deadline ? date(plan.deadline) : "—"} alert={schedule.fitsDeadline === false} />
      </section>

      <div className="mt-4 space-y-3">
        {view.pendingTitles === 0 && (
          <Notice>
            <p className="font-semibold">{t("planner.completed")}</p>
          </Notice>
        )}
        {schedule.fitsDeadline === false && (
          <Notice tone="error">
            <p className="font-semibold">{t("planner.lateTitle", { date: date(plan.deadline!) })}</p>
            {view.essential ? (
              <>
                <p className="mt-1">
                  {view.essential.fitsDeadline
                    ? t("planner.essentialFits", { date: view.essential.endDate ? date(view.essential.endDate) : "—" })
                    : t("planner.essentialLate", { date: view.essential.endDate ? date(view.essential.endDate) : "—" })}
                </p>
                <div className="mt-3">
                  <Button variant="danger" onClick={() => savePlan({ ...plan, essentialOnly: true })}>
                    {t("planner.useEssential")}
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-1">{t("planner.lateDetail")}</p>
            )}
          </Notice>
        )}
        {schedule.estimated > 0 && (
          <p className="text-xs text-fg-soft">{t("planner.estimated", { count: schedule.estimated })}</p>
        )}
      </div>

      <section className="mt-10">
        <SectionLabel>{t("planner.calendar")}</SectionLabel>
        {schedule.days.length === 0 ? (
          <p className="border-2 border-dashed border-line-soft p-6 text-center text-muted">{t("planner.nothingScheduled")}</p>
        ) : (
          <div className="space-y-6">
            {byWeek(schedule.days).map((week) => (
              <Week key={week.monday} monday={week.monday} days={week.days} plan={plan} />
            ))}
          </div>
        )}
      </section>

      <ExportSection plan={plan} days={schedule.days} />

      <section className="mt-10 flex flex-wrap gap-2">
        <Link
          to={`/plans/${plan.id}/edit`}
          className="inline-flex min-h-11 items-center border-2 border-line bg-surface px-5 py-2.5 text-[15px] font-bold transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
        >
          {t("planner.edit")}
        </Link>
        {plan.essentialOnly && (
          <Button onClick={() => savePlan({ ...plan, essentialOnly: undefined })}>{t("planner.useAll")}</Button>
        )}
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          {t("planner.delete")}
        </Button>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title={t("planner.delete")}
        confirmLabel={t("planner.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deletePlan(plan.id);
          navigate("/plans", { replace: true });
        }}
      >
        <p>{t("planner.deleteConfirm", { name: plan.name })}</p>
      </ConfirmDialog>
    </div>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="border-2 border-line bg-surface px-3.5 py-3">
      <p className="label text-muted">{label}</p>
      <p className={`mt-1 font-mono text-[15px] font-bold ${alert ? "text-alerta" : ""}`}>{value}</p>
    </div>
  );
}

function Week({ monday, days, plan }: { monday: string; days: PlanDay[]; plan: PlanDoc }) {
  const { t, lang, date, name } = useLang();
  const dayLabel = useDayLabel();
  const itemLabel = useItemLabel();
  const progress = useProgressStore((s) => s.progress);
  const minutes = days.reduce((n, d) => n + d.items.reduce((m, i) => m + i.minutes, 0), 0);
  const nameOf = (id: string) => {
    const title = catalogIndex.titlesById.get(id);
    return title ? name(title) : id;
  };

  return (
    <div>
      <div className="flex items-baseline justify-between border-b-[3px] border-line pb-1.5">
        <h3 className="display text-[20px]">{t("planner.weekOf", { date: date(monday) })}</h3>
        <span className="font-mono text-[11px] text-muted uppercase">{formatRuntime(minutes, t)}</span>
      </div>
      <ol>
        {days.map((day) => {
          const [event] = planEvents({ ...plan, lang }, [day], nameOf);
          return (
            <li key={day.date} className="flex gap-3 border-b-2 border-line-soft py-3">
              <div className="w-14 shrink-0 font-mono text-[11px] leading-tight font-bold uppercase">{dayLabel(day.date)}</div>
              <ul className="min-w-0 flex-1 space-y-2">
                {day.items.map((item) => {
                  const title = catalogIndex.titlesById.get(item.titleId);
                  if (!title) return null;
                  const whole = item.season === undefined;
                  const watched = progress[title.id]?.status === "watched";
                  return (
                    <li key={`${item.titleId}-${item.season}-${item.from}`} className="flex items-center gap-3">
                      <Link to={`/t/${title.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                        <Poster title={title} size="w92" className="h-12 w-8" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                            {itemLabel(item)}
                          </span>
                          <span className="font-mono text-[11px] text-muted uppercase">
                            {formatRuntime(item.minutes, t)}
                            {item.estimated && ` · ${t("planner.approx")}`}
                          </span>
                        </span>
                      </Link>
                      {whole && (
                        <WatchToggle
                          watched={watched}
                          label={t(watched ? "actions.unmarkWatched" : "actions.markWatched", { title: name(title) })}
                          onToggle={() => setTitleStatus(title, watched ? null : "watched")}
                        />
                      )}
                    </li>
                  );
                })}
                {event && (
                  <li>
                    <a href={googleCalendarLink(event)} target="_blank" rel="noopener" className="text-link font-mono text-[11px] uppercase">
                      {t("planner.addToGoogle")}
                    </a>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ExportSection({ plan, days }: { plan: PlanDoc; days: PlanDay[] }) {
  const { t, lang, name } = useLang();
  const user = useSession((s) => s.user);
  const profileId = useSession((s) => s.activeProfileId);
  const savePlan = usePlansStore((s) => s.savePlan);
  const nameOf = (id: string) => {
    const title = catalogIndex.titlesById.get(id);
    return title ? name(title) : id;
  };

  const download = () => {
    const ics = buildIcs(plan.name, planEvents({ ...plan, lang }, days, nameOf, location.origin));
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${plan.name.replace(/[^\p{L}\p{N}]+/gu, "-")}.ics` });
    a.click();
    URL.revokeObjectURL(url);
    if (!plan.calendarExported) savePlan({ ...plan, calendarExported: true });
  };

  const feedUrl =
    user && profileId && plan.feedToken
      ? `${location.origin}/api/calendar/${plan.id}.ics?${new URLSearchParams({ u: user.uid, p: profileId, k: plan.feedToken })}`
      : undefined;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: t("planner.copied") });
    } catch {
      showToast({ message: t("planner.copyFailed") });
    }
  };

  return (
    <section className="mt-10">
      <SectionLabel>{t("planner.export")}</SectionLabel>
      <div className="space-y-4 border-2 border-line bg-surface p-3.5">
        <div>
          <p className="font-semibold">{t("planner.icsTitle")}</p>
          <p className="mt-0.5 text-sm text-fg-soft">{t("planner.icsHint")}</p>
          <Button className="mt-3" onClick={download} disabled={days.length === 0}>
            {t("planner.download")}
          </Button>
        </div>
        <div className="border-t-2 border-line-soft pt-4">
          <p className="font-semibold">{t("planner.feedTitle")}</p>
          <p className="mt-0.5 text-sm text-fg-soft">{t(user ? "planner.feedHint" : "planner.feedGuest")}</p>
          {user &&
            (feedUrl ? (
              <div className="mt-3 space-y-3">
                <p className="border-2 border-line-soft bg-surface-muted px-2.5 py-2 font-mono text-[11px] break-all">{feedUrl}</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void copy(feedUrl)}>{t("planner.copyLink")}</Button>
                  <a
                    href={googleSubscribeLink(feedUrl)}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex min-h-11 items-center border-2 border-line bg-surface px-5 py-2.5 text-[15px] font-bold transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
                  >
                    {t("planner.subscribeGoogle")}
                  </a>
                  <a
                    href={feedUrl.replace(/^https?:/, "webcal:")}
                    className="inline-flex min-h-11 items-center border-2 border-line bg-surface px-5 py-2.5 text-[15px] font-bold transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
                  >
                    {t("planner.subscribeApple")}
                  </a>
                </div>
                <button type="button" className="text-link text-alerta uppercase" onClick={() => savePlan({ ...plan, feedToken: undefined })}>
                  {t("planner.revokeFeed")}
                </button>
              </div>
            ) : (
              <Button
                className="mt-3"
                onClick={() => savePlan({ ...plan, feedToken: newFeedToken(), calendarExported: true, schedule: days, lang })}
              >
                {t("planner.createFeed")}
              </Button>
            ))}
        </div>
      </div>
    </section>
  );
}
