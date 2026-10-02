import { useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { AchievementIcon } from "../../components/AchievementIcon";
import { ShareButton } from "../../components/ShareButton";
import { ProgressBar, SectionLabel } from "../../components/ui";
import { evaluateAchievements, type AchievementStatus } from "../../lib/achievements";
import { ACHIEVEMENTS } from "../../lib/achievementsCatalog";
import { useAchievementsStore, type UnlockDoc } from "../../lib/achievementsStore";
import { useCatalog } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { todayIso } from "../../lib/progress";
import { useProgressStore } from "../../lib/progressStore";
import { activityDays, computeStreak, localDay } from "../../lib/streaks";

export function AchievementsPage() {
  const { t } = useLang();
  const progress = useProgressStore((s) => s.progress);
  const unlocked = useAchievementsStore((s) => s.unlocked);
  const { hash } = useLocation();
  const today = todayIso();
  // Todas: cada logro muestra cuánto falta, también los de franquicias sin empezar.
  const catalog = useCatalog("all");

  const statuses = useMemo(
    () => (catalog.ready ? evaluateAchievements(ACHIEVEMENTS, { index: catalog.index, progress, today }) : []),
    [catalog.ready, catalog.index, progress, today],
  );
  const streak = useMemo(() => computeStreak(activityDays(progress), today), [progress, today]);
  const done = statuses
    .filter((s) => unlocked[s.achievement.id])
    .sort((a, b) => unlocked[b.achievement.id]!.unlockedAt.localeCompare(unlocked[a.achievement.id]!.unlockedAt));
  // Por desbloquear: primero los que están más cerca.
  const pending = statuses
    .filter((s) => !unlocked[s.achievement.id])
    .sort((a, b) => b.current / (b.target || 1) - a.current / (a.target || 1));

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [hash]);

  if (!catalog.ready) return <p className="py-16 text-center text-muted">…</p>;

  return (
    <div className="pt-6">
      <h1 className="display text-[39px]">{t("achievements.title")}</h1>

      <div className="mt-6 grid grid-cols-3 gap-[2px] border-2 border-line bg-line">
        <Counter label={t("achievements.unlocked")} value={`${done.length}/${ACHIEVEMENTS.length}`} />
        <Counter label={t("stats.streak")} value={t("stats.daysShort", { count: streak.current })} />
        <Counter label={t("achievements.best")} value={t("stats.daysShort", { count: streak.best })} />
      </div>
      <p className="mt-2 text-xs text-fg-soft">{t("achievements.streakHint")}</p>

      {done.length > 0 && (
        <section className="mt-10">
          <SectionLabel>{t("achievements.unlocked")}</SectionLabel>
          <ul className="grid gap-3 lg:grid-cols-2">
            {done.map((s) => (
              <AchievementRow key={s.achievement.id} status={s} unlock={unlocked[s.achievement.id]} highlight={hash === `#${s.achievement.id}`} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <SectionLabel>{t("achievements.pending")}</SectionLabel>
        <ul className="grid gap-3 lg:grid-cols-2">
          {pending.map((s) => (
            <AchievementRow key={s.achievement.id} status={s} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3 py-3">
      <p className="label text-muted">{label}</p>
      <p className="display mt-1 text-[25px] tabular-nums">{value}</p>
    </div>
  );
}

function AchievementRow({ status, unlock, highlight = false }: { status: AchievementStatus; unlock?: UnlockDoc; highlight?: boolean }) {
  const { t, loc, date } = useLang();
  const { achievement: a, current, target } = status;
  const name = loc(a.name);
  const day = unlock ? localDay(unlock.unlockedAt) : undefined;

  return (
    <li
      id={a.id}
      className={`scroll-mt-24 border-2 bg-surface ${unlock ? "border-line" : "border-line-soft"} ${highlight ? "outline-[3px] outline-offset-2 outline-faro outline-solid" : ""}`}
    >
      <div className="flex items-start gap-3.5 p-3.5">
        <span
          className={`grid size-14 shrink-0 place-items-center border-2 ${
            unlock ? "border-tinta bg-faro text-tinta" : "border-dashed border-line-soft text-muted"
          }`}
        >
          <AchievementIcon icon={a.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${unlock ? "" : "text-fg-soft"}`}>{name}</p>
          <p className="mt-0.5 text-sm leading-[1.5] text-fg-soft">{loc(a.description)}</p>
          {unlock ? (
            <p className="mt-1.5 font-mono text-[11px] text-muted uppercase">{t("achievements.unlockedOn", { date: date(day!) })}</p>
          ) : (
            target > 0 && (
              <div className="mt-2.5">
                <ProgressBar ratio={current / target} label={name} />
                <p className="mt-1 font-mono text-[11px] text-muted uppercase">
                  {a.rule.type === "count" && a.rule.metric === "hours"
                    ? t("achievements.progressHours", { current, target })
                    : a.rule.type === "streak"
                      ? t("achievements.progressDays", { current, target })
                      : t("achievements.progress", { current, target })}
                  {a.rule.type === "watched-in-order" && ` · ${t("achievements.inOrder")}`}
                </p>
              </div>
            )
          )}
        </div>
      </div>
      {unlock && (
        <div className="border-t-2 border-line-soft px-3.5 py-2.5">
          <ShareButton
            card={{ kind: "achievement", id: a.id, d: day }}
            title={name}
            text={t("achievements.shareText", { name })}
            fileName={`watch-order-${a.id}`}
            className="!min-h-10 !px-4 !py-1.5 !text-sm"
          />
        </div>
      )}
    </li>
  );
}
