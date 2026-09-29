import { createBrowserRouter, Link, Outlet, RouterProvider, useLocation } from "react-router";
import { useEffect } from "react";
import { FranchisePage } from "./features/franchise/FranchisePage";
import { HubPage } from "./features/hub/HubPage";
import { TitlePage } from "./features/detail/TitlePage";
import { LANGS, useLang } from "./lib/i18n";

function Layout() {
  const { t, lang, setLang } = useLang();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4">
      <header className="sticky top-0 z-20 -mx-4 flex h-14 items-center justify-between bg-bg/85 px-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" className="size-6" />
          {t("app.name")}
        </Link>
        <div role="group" aria-label={t("nav.language")} className="flex rounded-full bg-surface p-0.5 text-xs">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`rounded-full px-2.5 py-1 font-medium uppercase ${lang === l ? "bg-surface-2 text-ink" : "text-faint"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 pb-12">
        <Outlet />
      </main>
      <footer className="border-t border-white/5 py-6 text-center text-xs text-faint">
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
