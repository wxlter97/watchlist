import { createBrowserRouter, Link, Outlet, RouterProvider, useLocation } from "react-router";
import { lazy, Suspense, useEffect, useSyncExternalStore } from "react";
import { AppMark, Button, Notice, SearchIcon, WxlterSymbol } from "./components/ui";
import { Toaster } from "./components/Toaster";
import { AccountPage } from "./features/account/AccountPage";
import { FranchisePage } from "./features/franchise/FranchisePage";
import { HubPage } from "./features/hub/HubPage";
import { TitlePage } from "./features/detail/TitlePage";
import { RoutePage } from "./features/routes/RoutePage";
import { SearchPage } from "./features/search/SearchPage";
import { StatsPage } from "./features/stats/StatsPage";
import { PlanEditor } from "./features/planner/PlanEditor";
import { PlanPage } from "./features/planner/PlanPage";
import { PlansPage } from "./features/planner/PlansPage";
import { PlanSync } from "./features/planner/PlanSync";
import { TimelinePage } from "./features/timeline/TimelinePage";
import { AchievementsPage } from "./features/achievements/AchievementsPage";
import { AchievementSync } from "./features/achievements/AchievementSync";
import { WrappedPage } from "./features/wrapped/WrappedPage";

// El mapa trae d3-force: se carga solo al abrirlo.
const GraphPage = lazy(() => import("./features/graph/GraphPage").then((m) => ({ default: m.GraphPage })));
import { useLang } from "./lib/i18n";
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

function Layout() {
  const { t } = useLang();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4">
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
        <Outlet />
      </main>
      <Toaster />
      <PlanSync />
      <AchievementSync />
      <footer className="-mx-4 flex flex-col gap-2 border-t-2 border-line px-4 py-6 font-mono text-[11px] text-muted">
        <a href="https://wxlter.dev" className="flex items-center gap-2 self-start font-bold text-fg">
          <WxlterSymbol size={16} />
          {t("about.madeBy")}
        </a>
        <p>{t("about.tmdb")}</p>
      </footer>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HubPage /> },
      { path: "f/:franchiseId", element: <FranchisePage /> },
      { path: "f/:franchiseId/r/:routeId", element: <RoutePage /> },
      { path: "t/:titleId", element: <TitlePage /> },
      { path: "account", element: <AccountPage /> },
      { path: "search", element: <SearchPage /> },
      { path: "stats", element: <StatsPage /> },
      { path: "f/:franchiseId/timeline", element: <TimelinePage /> },
      {
        path: "map",
        element: (
          <Suspense fallback={<p className="py-16 text-center font-mono text-xs text-muted uppercase">…</p>}>
            <GraphPage />
          </Suspense>
        ),
      },
      { path: "achievements", element: <AchievementsPage /> },
      { path: "wrapped", element: <WrappedPage /> },
      { path: "wrapped/:year", element: <WrappedPage /> },
      { path: "plans", element: <PlansPage /> },
      { path: "plans/new", element: <PlanEditor /> },
      { path: "plans/:planId", element: <PlanPage /> },
      { path: "plans/:planId/edit", element: <PlanEditor /> },
      { path: "*", element: <HubPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
