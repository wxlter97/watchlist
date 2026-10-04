import { ConsentBanner } from "./components/ConsentBanner";
import { RouteError } from "./components/RouteError";
import { createBrowserRouter, Link, Outlet, RouterProvider, useLocation, useNavigationType, type RouteObject } from "react-router";
import { lazy, Suspense, useEffect, useLayoutEffect, useSyncExternalStore, type ComponentType } from "react";
import { AppMark, Button, Notice, SearchIcon, WxlterSymbol } from "./components/ui";
import { DonateLink } from "./components/DonateLink";
import { NotFound } from "./components/NotFound";
import { Toaster } from "./components/Toaster";
import { HubPage } from "./features/hub/HubPage";

// Todo menos el Hub va en chunks propios: el arranque carga lo mínimo para pintar la portada.
// El mapa además trae d3-force.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
// Lo que se abre desde el Hub se descarga apenas la página termina de cargar, para que
// navegar siga siendo inmediato (después el service worker lo tiene en caché).
const loadFranchise = () => import("./features/franchise/FranchisePage");
const loadTitle = () => import("./features/detail/TitlePage");
const loadRoute = () => import("./features/routes/RoutePage");
const loadPrep = () => import("./features/routes/PrepPage");
const loadSearch = () => import("./features/search/SearchPage");
const FranchisePage = page(loadFranchise, "FranchisePage");
const TitlePage = page(loadTitle, "TitlePage");
const RoutePage = page(loadRoute, "RoutePage");
const PrepPage = page(loadPrep, "PrepPage");
const SearchPage = page(loadSearch, "SearchPage");
// Sincronización en segundo plano (logros, feeds de planes, progreso de grupos): no hace
// falta para pintar, se carga después.
const PlanSync = page(() => import("./features/planner/PlanSync"), "PlanSync");
const AchievementSync = page(() => import("./features/achievements/AchievementSync"), "AchievementSync");
const GroupSync = page(() => import("./features/groups/GroupSync"), "GroupSync");
function prefetchPages() {
  const run = () => [loadFranchise, loadTitle, loadRoute, loadSearch].forEach((load) => void load().catch(() => undefined));
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 500));
  if (document.readyState === "complete") idle();
  else addEventListener("load", idle, { once: true });
}
prefetchPages();
const GraphPage = page(() => import("./features/graph/GraphPage"), "GraphPage");
const StatsPage = page(() => import("./features/stats/StatsPage"), "StatsPage");
const PlanEditor = page(() => import("./features/planner/PlanEditor"), "PlanEditor");
const PlanPage = page(() => import("./features/planner/PlanPage"), "PlanPage");
const PlansPage = page(() => import("./features/planner/PlansPage"), "PlansPage");
const TimelinePage = page(() => import("./features/timeline/TimelinePage"), "TimelinePage");
const AchievementsPage = page(() => import("./features/achievements/AchievementsPage"), "AchievementsPage");
const WrappedPage = page(() => import("./features/wrapped/WrappedPage"), "WrappedPage");
const ComparePage = page(() => import("./features/groups/ComparePage"), "ComparePage");
const GroupPage = page(() => import("./features/groups/GroupPage"), "GroupPage");
const GroupsPage = page(() => import("./features/groups/GroupsPage"), "GroupsPage");
const JoinPage = page(() => import("./features/groups/JoinPage"), "JoinPage");
const PrivacyPage = page(() => import("./features/legal/LegalPage"), "PrivacyPage");
const TermsPage = page(() => import("./features/legal/LegalPage"), "TermsPage");
const FaqPage = page(() => import("./features/content/ContentPage"), "FaqPage");
const GuidePage = page(() => import("./features/content/ContentPage"), "GuidePage");
const AccountPage = page(() => import("./features/account/AccountPage"), "AccountPage");
import { useLang } from "./lib/i18n";
import { trackPageView } from "./lib/analytics";
import { applyMeta, isPrivatePath } from "./lib/meta";
import { restoreScroll, savedScroll, setCurrentKey, trackScroll } from "./lib/scroll";
import { dismissMigration, migrateGuestProgress, useSession } from "./lib/session";

function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

function AccountButton() {
  const { t } = useLang();
  const status = useSession((s) => s.status);
  const profile = useSession((s) => s.profiles.find((p) => p.id === s.activeProfileId));

  if (status === "signedIn") {
    return (
      <Link
        to="/account"
        aria-label={t("account.title")}
        title={profile?.name}
        className="display grid size-9 place-items-center border-2 border-line bg-faro text-lg text-tinta transition-colors duration-[120ms] ease-out hover:bg-tinta hover:text-faro"
      >
        {profile?.avatar ?? "·"}
      </Link>
    );
  }
  return (
    <Link
      to="/account"
      className="label min-h-9 border-2 border-line px-2 py-2 font-bold transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
    >
      {status === "loading" ? "…" : t("nav.signIn")}
    </Link>
  );
}

function Banners() {
  const { t } = useLang();
  const online = useOnline();
  const migration = useSession((s) => s.migration);
  const profile = useSession((s) => s.profiles.find((p) => p.id === s.activeProfileId));

  return (
    <div className="space-y-3 empty:hidden [&:not(:empty)]:pt-4">
      {!online && (
        <Notice>
          <p>{t("sync.offline")}</p>
        </Notice>
      )}
      {migration && (
        <Notice>
          <p>{t("sync.migrate", { count: migration.count })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={migrateGuestProgress}>
              {t("sync.migrateAction", { profile: profile?.name ?? "" })}
            </Button>
            <Button onClick={dismissMigration}>{t("sync.later")}</Button>
          </div>
        </Notice>
      )}
    </div>
  );
}

/** Título de las pantallas que no son del catálogo (el resto lo fija cada página con usePageMeta). */
const PAGE_TITLES: Record<string, string> = {
  "/search": "search.title",
  "/stats": "stats.title",
  "/plans": "planner.title",
  "/account": "account.title",
  "/achievements": "achievements.title",
  "/groups": "groups.title",
  "/join": "groups.title",
  "/compare": "compare.title",
  "/wrapped": "wrapped.title",
  "/map": "graph.title",
  "/privacy": "legal.privacy.title",
  "/terms": "legal.terms.title",
  "/faq": "content.faq.title",
  "/guide": "content.guide.title",
};

function Layout() {
  const { t, lang } = useLang();
  const { pathname, key } = useLocation();
  const navigationType = useNavigationType();

  // Meta base de cada ruta, antes de que la página (efecto pasivo) ponga la suya: un layout effect
  // corre antes que cualquier useEffect.
  useEffect(() => trackPageView(pathname), [pathname]);

  // Meta base de la ruta sin el prefijo /en (las URLs en inglés son las mismas pantallas).
  const path = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  useLayoutEffect(() => {
    const site = t("meta.siteDescription");
    const pageKey = PAGE_TITLES["/" + path.split("/")[1]];
    if (path === "/") applyMeta({ title: t("meta.siteTitle"), canonical: "/" }, site);
    else if (pageKey) {
      const isPrivate = isPrivatePath(path);
      applyMeta({ title: t("meta.pageTitle", { page: t(pageKey) }), noindex: isPrivate, canonical: isPrivate ? undefined : path }, site);
    } else applyMeta({ title: t("meta.siteTitle") }, site);
  }, [path, lang, t]);

  // El navegador no restaura el scroll de una SPA: se guarda mientras te desplazas y se
  // restaura al volver con "atrás"; en una entrada nueva se empieza arriba. Un reemplazo (?nivel=) no mueve nada.
  useEffect(() => {
    history.scrollRestoration = "manual";
    return trackScroll();
  }, []);
  useLayoutEffect(() => {
    setCurrentKey(key);
    if (navigationType === "REPLACE") return;
    const saved = navigationType === "POP" ? savedScroll(key) : undefined;
    if (saved === undefined) {
      window.scrollTo(0, 0);
      return undefined;
    }
    return restoreScroll(saved);
  }, [pathname, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 lg:max-w-6xl">
      <header className="sticky top-0 z-20 -mx-4 flex h-[58px] items-center justify-between gap-3 border-b-2 border-line bg-bg px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <AppMark size={30} />
          {/* En pantallas angostas no cabe junto a los accesos: queda el ícono (y el nombre para lectores). */}
          <span className="display truncate text-lg whitespace-nowrap max-[419px]:sr-only">{t("app.name")}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to="/plans"
            aria-label={t("planner.title")}
            className="grid size-9 place-items-center border-2 border-line transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <rect x="3.5" y="5" width="17" height="15.5" />
              <path d="M3.5 10h17M8 2.5v5M16 2.5v5" strokeLinecap="square" />
            </svg>
          </Link>
          <Link
            to="/stats"
            aria-label={t("stats.title")}
            className="grid size-9 place-items-center border-2 border-line transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
              <rect x="3" y="12" width="4" height="9" />
              <rect x="10" y="6" width="4" height="15" />
              <rect x="17" y="3" width="4" height="18" />
            </svg>
          </Link>
          <Link
            to="/search"
            aria-label={t("search.title")}
            className="grid size-9 place-items-center border-2 border-line transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
          >
            <SearchIcon />
          </Link>
          <AccountButton />
        </div>
      </header>
      <Banners />
      <main className="flex-1 pb-16">
        <Suspense fallback={<p className="py-16 text-center font-mono text-xs text-muted uppercase">…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <Toaster />
      <ConsentBanner />
      <Suspense fallback={null}>
        <PlanSync />
        <AchievementSync />
        <GroupSync />
      </Suspense>
      <footer className="-mx-4 flex flex-col gap-2 border-t-2 border-line px-4 py-6 font-mono text-[11px] text-muted">
        <a href="https://wxlter.dev" className="flex items-center gap-2 self-start font-bold text-fg">
          <WxlterSymbol size={16} />
          {t("about.madeBy")}
        </a>
        <DonateLink />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <a href="https://www.themoviedb.org" target="_blank" rel="noopener" className="shrink-0">
            <img src="/tmdb-logo.svg" alt="TMDB" width={74} height={32} loading="lazy" className="h-6 w-auto" />
          </a>
          <span className="min-w-0 flex-1">{t("about.tmdb")}</span>
        </p>
        <a href="mailto:work@wxlter.dev?subject=Watch%20Order" className="self-start underline">
          {t("about.report")}
        </a>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/faq" className="underline">
            {t("content.links.faq")}
          </Link>
          <Link to="/guide" className="underline">
            {t("content.links.guide")}
          </Link>
          <Link to="/privacy" className="underline">
            {t("legal.privacyLink")}
          </Link>
          <Link to="/terms" className="underline">
            {t("legal.termsLink")}
          </Link>
        </p>
      </footer>
    </div>
  );
}

/** Las pantallas de la app; se repiten bajo /en para las URLs en inglés (el idioma lo toma i18n.ts). */
const appRoutes: RouteObject[] = [
  { path: "privacy", element: <PrivacyPage /> },
  { path: "terms", element: <TermsPage /> },
  { path: "faq", element: <FaqPage /> },
  { path: "guide", element: <GuidePage /> },
  { index: true, element: <HubPage /> },
  { path: "f/:franchiseId", element: <FranchisePage /> },
  { path: "f/:franchiseId/r/:routeId", element: <RoutePage /> },
  { path: "f/:franchiseId/prep/:titleId", element: <PrepPage /> },
  { path: "t/:titleId", element: <TitlePage /> },
  { path: "account", element: <AccountPage /> },
  { path: "search", element: <SearchPage /> },
  { path: "stats", element: <StatsPage /> },
  { path: "f/:franchiseId/timeline", element: <TimelinePage /> },
  { path: "map", element: <GraphPage /> },
  { path: "achievements", element: <AchievementsPage /> },
  { path: "groups", element: <GroupsPage /> },
  { path: "groups/:groupId", element: <GroupPage /> },
  { path: "join/:groupId", element: <JoinPage /> },
  { path: "compare", element: <ComparePage /> },
  { path: "wrapped", element: <WrappedPage /> },
  { path: "wrapped/:year", element: <WrappedPage /> },
  { path: "plans", element: <PlansPage /> },
  { path: "plans/new", element: <PlanEditor /> },
  { path: "plans/:planId", element: <PlanPage /> },
  { path: "plans/:planId/edit", element: <PlanEditor /> },
  { path: "*", element: <NotFound /> },
];

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [...appRoutes, { path: "en", children: appRoutes }],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
