import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { AchievementIcon } from "../../components/AchievementIcon";
import { ShareButton } from "../../components/ShareButton";
import { accentStyle, Button, formatRuntime, Poster } from "../../components/ui";
import { achievementsById } from "../../lib/achievementsCatalog";
import { useAchievementsStore } from "../../lib/achievementsStore";
import { franchisesMentioning, useCatalog } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { todayIso } from "../../lib/progress";
import { useProgressStore } from "../../lib/progressStore";
import { cardUrl, type CardParams } from "../../lib/share";
import { computeWrapped, type Wrapped } from "../../lib/wrapped";

// Resumen anual (SPEC §9.4): pantallas deslizables y una tarjeta final para compartir.

export function WrappedPage() {
  const { year: param } = useParams();
  const { t } = useLang();
  const currentYear = Number(todayIso().slice(0, 4));
  const year = param && /^\d{4}$/.test(param) ? Number(param) : currentYear;
  const progress = useProgressStore((s) => s.progress);
  const unlocked = useAchievementsStore((s) => s.unlocked);
  const catalog = useCatalog(useMemo(() => franchisesMentioning(Object.keys(progress)), [progress]));
  const wrapped = useMemo(() => computeWrapped(catalog.index, progress, unlocked, year), [catalog.index, progress, unlocked, year]);

  if (!catalog.ready) return <p className="py-16 text-center text-muted">…</p>;

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/stats" className="label inline-block border-b-2 border-current pb-0.5 font-bold">
          ← {t("stats.title")}
        </Link>
        <nav className="flex gap-1.5" aria-label={t("wrapped.years")}>
          {[currentYear - 1, currentYear].map((y) => (
            <Link
              key={y}
              to={`/wrapped/${y}`}
              aria-current={y === year ? "page" : undefined}
              className={`border-2 px-2.5 py-1 font-mono text-xs font-bold ${y === year ? "border-line bg-faro text-tinta" : "border-line-soft hover:border-line"}`}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>
      {wrapped.titles.length === 0 && wrapped.minutes === 0 ? (
        <div className="py-16 text-center">
          <p className="display text-[31px]">{t("wrapped.emptyTitle", { year })}</p>
          <p className="mt-3 text-fg-soft">{t("wrapped.empty")}</p>
        </div>
      ) : (
        <Slides wrapped={wrapped} />
      )}
    </div>
  );
}

function Slides({ wrapped }: { wrapped: Wrapped }) {
  const { t, lang, loc, name } = useLang();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const hours = Math.round(wrapped.minutes / 60);
  const monthName = (m: number) =>
    new Intl.DateTimeFormat(t("meta.locale"), { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(wrapped.year, m - 1, 1)));

  const card: CardParams = {
    kind: "wrapped",
    y: wrapped.year,
    h: hours,
    t: wrapped.titles.length,
    f: wrapped.topFranchise?.franchise.id,
    top: wrapped.topTitle?.title.id,
    m: wrapped.topMonth,
    a: wrapped.achievements.length,
  };

  const slides: { key: string; content: ReactNode; accent?: string }[] = [
    {
      key: "intro",
      content: (
        <>
          <p className="label font-bold">{t("wrapped.eyebrow")}</p>
          <p className="display mt-4 text-[64px] leading-[0.95]">{t("wrapped.intro", { year: wrapped.year })}</p>
          <p className="mt-6 text-lg">{t("wrapped.swipe")}</p>
        </>
      ),
    },
    {
      key: "hours",
      content: (
        <>
          <p className="label font-bold">{t("wrapped.hoursLabel")}</p>
          <p className="display mt-3 text-[112px] leading-none tabular-nums">{hours}</p>
          <p className="mt-2 font-mono text-sm uppercase">{t("wrapped.hoursUnit")}</p>
          <p className="mt-8 text-lg leading-[1.5]">
            {t("wrapped.titlesCount", { count: wrapped.titles.length })}
            {wrapped.episodes > 0 && ` ${t("wrapped.episodesCount", { count: wrapped.episodes })}`}
          </p>
        </>
      ),
    },
  ];

  if (wrapped.topFranchise) {
    const f = wrapped.topFranchise;
    slides.push({
      key: "franchise",
      accent: f.franchise.accentColor,
      content: (
        <>
          <p className="label font-bold">{t("wrapped.franchiseLabel")}</p>
          <p className="display mt-4 text-[56px] leading-[0.95] [text-wrap:balance]">{loc(f.franchise.name)}</p>
          <p className="mt-6 text-lg">{t("wrapped.franchiseTime", { time: formatRuntime(f.minutes, t) })}</p>
        </>
      ),
    });
  }

  if (wrapped.topTitle) {
    const top = wrapped.topTitle;
    slides.push({
      key: "top",
      content: (
        <>
          <p className="label font-bold">{t("wrapped.topLabel")}</p>
          <div className="mt-5 flex items-end gap-4">
            <Poster title={top.title} size="w342" className="h-[210px] w-[140px]" />
            <div className="min-w-0">
              <p className="display text-[31px] leading-[1.02] [text-wrap:balance]">{name(top.title)}</p>
              <p className="mt-2 font-mono text-sm">{"★".repeat(top.rating)}{"☆".repeat(5 - top.rating)}</p>
            </div>
          </div>
        </>
      ),
    });
  }

  if (wrapped.topMonth) {
    const max = Math.max(...wrapped.months);
    slides.push({
      key: "month",
      content: (
        <>
          <p className="label font-bold">{t("wrapped.monthLabel")}</p>
          <p className="display mt-4 text-[56px] leading-none capitalize">{monthName(wrapped.topMonth)}</p>
          <div className="mt-8 flex h-32 items-end gap-1.5" role="img" aria-label={t("wrapped.monthChart")}>
            {wrapped.months.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full border-2 border-current ${i + 1 === wrapped.topMonth ? "bg-current" : ""}`}
                  style={{ height: `${Math.max(4, (n / max) * 100)}px` }}
                />
                <span className="font-mono text-[10px] uppercase">{monthName(i + 1).slice(0, 1)}</span>
              </div>
            ))}
          </div>
        </>
      ),
    });
  }

  slides.push({
    key: "achievements",
    content: (
      <>
        <p className="label font-bold">{t("wrapped.achievementsLabel")}</p>
        <p className="display mt-3 text-[80px] leading-none tabular-nums">{wrapped.achievements.length}</p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {wrapped.achievements.slice(0, 8).map((id) => {
            const a = achievementsById.get(id);
            return a ? (
              <li key={id} title={loc(a.name)} className="grid size-11 place-items-center border-2 border-tinta bg-faro text-tinta">
                <AchievementIcon icon={a.icon} className="size-6" />
                <span className="sr-only">{loc(a.name)}</span>
              </li>
            ) : null;
          })}
        </ul>
        {wrapped.bestStreak > 1 && <p className="mt-6 text-lg">{t("wrapped.streak", { count: wrapped.bestStreak })}</p>}
      </>
    ),
  });

  slides.push({
    key: "share",
    content: (
      <>
        <p className="label font-bold">{t("wrapped.shareLabel")}</p>
        <img
          src={cardUrl(card, lang)}
          alt={t("wrapped.cardAlt", { year: wrapped.year })}
          className="mt-4 aspect-square w-full max-w-[340px] border-2 border-current bg-tinta"
          loading="lazy"
        />
        <div className="mt-4">
          <ShareButton
            card={card}
            variant="primary"
            title={t("wrapped.intro", { year: wrapped.year })}
            text={t("wrapped.shareText", { year: wrapped.year, hours })}
            fileName={`watch-order-${wrapped.year}`}
          />
        </div>
      </>
    ),
  });

  const go = (i: number) => {
    const el = track.current;
    const target = Math.max(0, Math.min(slides.length - 1, i));
    setIndex(target);
    el?.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };

  // La diapositiva visible se deduce del scroll (sirve para el deslizamiento táctil y los botones).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // Solo al terminar de desplazarse: durante el scroll suave la posición va a medio camino.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIndex(Math.round(el.scrollLeft / el.clientWidth)), 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section
      aria-roledescription={t("wrapped.carousel")}
      aria-label={t("wrapped.intro", { year: wrapped.year })}
      className="mt-6"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div
        ref={track}
        tabIndex={0}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory overflow-x-auto border-y-2 border-line"
      >
        {slides.map((slide, i) => (
          <div
            key={slide.key}
            role="group"
            aria-roledescription={t("wrapped.slide")}
            aria-label={t("wrapped.slideOf", { current: i + 1, total: slides.length })}
            // Faro y Tinta alternados; la franquicia del año, con su color.
            style={accentStyle(slide.accent ?? (i % 2 ? "#111111" : "#FFDB00"))}
            className="flex min-h-[520px] w-full shrink-0 snap-start flex-col justify-center bg-accent px-6 py-10 text-on-accent"
          >
            {slide.content}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button className="!px-4" aria-label={t("wrapped.prev")} disabled={index === 0} onClick={() => go(index - 1)}>
          ←
        </Button>
        <div className="flex gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={t("wrapped.slideOf", { current: i + 1, total: slides.length })}
              aria-current={i === index ? "step" : undefined}
              onClick={() => go(i)}
              className={`size-3 border-2 border-line ${i === index ? "bg-fg" : "bg-surface"}`}
            />
          ))}
        </div>
        <Button className="!px-4" aria-label={t("wrapped.next")} disabled={index === slides.length - 1} onClick={() => go(index + 1)}>
          →
        </Button>
      </div>
    </section>
  );
}
