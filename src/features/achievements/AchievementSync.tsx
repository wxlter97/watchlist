import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { evaluateAchievements, newlyUnlocked } from "../../lib/achievements";
import { ACHIEVEMENTS, achievementsById } from "../../lib/achievementsCatalog";
import { useAchievementsStore } from "../../lib/achievementsStore";
import { catalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { todayIso } from "../../lib/progress";
import { useProgressStore } from "../../lib/progressStore";
import { useSession } from "../../lib/session";
import { showToast } from "../../lib/toasts";

/** Evalúa los logros cuando cambia el progreso y avisa de los recién desbloqueados. */
export function AchievementSync() {
  const lang = useLang();
  const navigate = useNavigate();
  // Textos y navegación al momento de avisar, sin reiniciar la evaluación en cada render.
  const latest = useRef({ lang, navigate });
  latest.current = { lang, navigate };
  const ready = useSession((s) => s.profileReady);
  const loaded = useAchievementsStore((s) => s.loaded);
  const progress = useProgressStore((s) => s.progress);

  useEffect(() => {
    if (!ready || !loaded) return;
    const timer = setTimeout(() => {
      const statuses = evaluateAchievements(ACHIEVEMENTS, { index: catalogIndex, progress, today: todayIso() });
      const fresh = newlyUnlocked(statuses, useAchievementsStore.getState().unlocked);
      if (!fresh.length) return;
      useAchievementsStore.getState().unlock(fresh);
      const { t, loc } = latest.current.lang;
      const first = achievementsById.get(fresh[0]!)!;
      showToast({
        message:
          fresh.length === 1
            ? t("achievements.unlockedOne", { name: loc(first.name) })
            : t("achievements.unlockedMany", { count: fresh.length }),
        action: { label: t("achievements.see"), onClick: () => latest.current.navigate(fresh.length === 1 ? `/achievements#${fresh[0]}` : "/achievements") },
        duration: 8000,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [ready, loaded, progress]);

  return null;
}
