import { createBrowserRouter, Link, Outlet, RouterProvider, useLocation } from "react-router";
import { useEffect } from "react";
import { AppMark, Tabs, Toggle, WxlterSymbol } from "./components/ui";
import { FranchisePage } from "./features/franchise/FranchisePage";
import { HubPage } from "./features/hub/HubPage";
import { TitlePage } from "./features/detail/TitlePage";
import { LANGS, useLang } from "./lib/i18n";
import { setTheme, useTheme } from "./lib/theme";

function Layout() {
  const { t, lang, setLang } = useLang();
  const theme = useTheme();
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
        <div className="flex shrink-0 items-center gap-2.5">
          <Tabs
            size="sm"
            label={t("nav.language")}
            value={lang}
            options={LANGS.map((l) => ({ value: l, label: l }))}
            onChange={setLang}
          />
          <Toggle checked={theme === "dark"} label={t("nav.darkMode")} onChange={(dark) => setTheme(dark ? "dark" : "light")} />
        </div>
      </header>
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
      { path: "t/:titleId", element: <TitlePage /> },
      { path: "*", element: <HubPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
