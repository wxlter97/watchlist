import { createBrowserRouter, Link, Outlet, RouterProvider, useLocation } from "react-router";
import { useEffect, useSyncExternalStore } from "react";
import { AppMark, Button, Notice, SearchIcon, WxlterSymbol } from "./components/ui";
import { AccountPage } from "./features/account/AccountPage";
import { FranchisePage } from "./features/franchise/FranchisePage";
import { HubPage } from "./features/hub/HubPage";
import { TitlePage } from "./features/detail/TitlePage";
import { RoutePage } from "./features/routes/RoutePage";
import { SearchPage } from "./features/search/SearchPage";
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
      className="label min-h-9 border-2 border-line px-2.5 py-2 font-bold transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
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
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <AppMark size={32} />
          <span className="display truncate text-xl">{t("app.name")}</span>
        </Link>
        <div className="flex items-center gap-2">
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
      { path: "*", element: <HubPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
