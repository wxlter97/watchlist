import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { TitleRow } from "../../components/TitleRow";
import { accentStyle, SearchIcon, SectionLabel } from "../../components/ui";
import { useCatalog } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { addRecent, clearRecent, loadRecent, removeRecent } from "../../lib/recentSearches";
import { searchCatalog } from "../../lib/search";

export function SearchPage() {
  const { t, lang, loc } = useLang();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const deferred = useDeferredValue(query);
  // La búsqueda recorre todo el catálogo: se descarga al abrirla (con el service worker, una vez).
  const catalog = useCatalog("all");
  const results = useMemo(() => searchCatalog(catalog.index, deferred, lang), [catalog.index, deferred, lang]);
  const hasResults = results.titles.length + results.franchises.length + results.routes.length > 0;
  const [recent, setRecent] = useState(loadRecent);
  // Se guarda la búsqueda que dio resultados y se quedó quieta un momento (no cada letra).
  useEffect(() => {
    if (!catalog.ready || !hasResults || deferred.trim().length < 2) return;
    const timer = setTimeout(() => setRecent(addRecent(deferred)), 1500);
    return () => clearTimeout(timer);
  }, [catalog.ready, hasResults, deferred]);
  const empty = deferred.trim() && !results.titles.length && !results.franchises.length && !results.routes.length;

  return (
    <div className="pt-6">
      <h1 className="display text-[39px]">{t("search.title")}</h1>
      <label className="mt-4 flex min-h-12 items-center gap-3 border-2 border-line bg-surface px-3 focus-within:outline-3 focus-within:outline-faro">
        <SearchIcon />
        <span className="sr-only">{t("search.title")}</span>
        <input
          type="search"
          autoFocus
          value={query}
          placeholder={t("search.placeholder")}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted"
        />
      </label>

      {!deferred.trim() && recent.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <SectionLabel>{t("search.recent")}</SectionLabel>
            <button type="button" onClick={() => setRecent(clearRecent())} className="text-link font-mono text-[11px] uppercase">
              {t("search.clearRecent")}
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {recent.map((q) => (
              <li key={q} className="flex border-2 border-line bg-surface">
                <button type="button" onClick={() => setParams({ q }, { replace: true })} className="min-h-10 px-3 font-mono text-sm hover:bg-fg hover:text-bg">
                  {q}
                </button>
                <button
                  type="button"
                  aria-label={t("search.removeRecent", { query: q })}
                  onClick={() => setRecent(removeRecent(q))}
                  className="min-h-10 border-l-2 border-line-soft px-2.5 font-mono text-muted hover:bg-fg hover:text-bg"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!deferred.trim() && <p className="mt-6 text-sm text-fg-soft">{t("search.hint")}</p>}
      {deferred.trim() && !catalog.ready && <p className="mt-6 text-sm text-muted">…</p>}
      {empty && catalog.ready && <p className="mt-6 text-sm text-fg-soft">{t("search.empty", { query: deferred })}</p>}

      {results.franchises.length > 0 && (
        <section className="mt-8">
          <SectionLabel>{t("hub.franchises")}</SectionLabel>
          <ul className="flex flex-wrap gap-2">
            {results.franchises.map((f) => (
              <li key={f.id} style={accentStyle(f.accentColor)}>
                <Link to={`/f/${f.id}`} className="label inline-block border-2 border-line bg-accent px-3 py-2 font-bold text-on-accent">
                  {loc(f.name)} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.routes.length > 0 && (
        <section className="mt-8">
          <SectionLabel>{t("routes.title")}</SectionLabel>
          <ul className="border-2 border-line bg-surface">
            {results.routes.map(({ franchise, route }) => (
              <li key={`${franchise.id}/${route.id}`} className="border-b-2 border-line-soft last:border-b-0">
                <Link
                  to={`/f/${franchise.id}/r/${route.id}`}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors duration-[120ms] ease-out hover:bg-surface-muted"
                >
                  <span className="min-w-0">
                    <span className="label block text-muted">
                      {loc(franchise.name)} · {t(`routes.kinds.${route.kind}`)}
                    </span>
                    <span className="font-semibold">{loc(route.name)}</span>
                  </span>
                  <span aria-hidden className="font-mono">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.titles.length > 0 && (
        <section className="mt-8">
          <SectionLabel>{t("search.titles", { count: results.titles.length })}</SectionLabel>
          <ol className="lg:grid lg:grid-cols-2 lg:gap-x-10">
            {results.titles.map((title, i) => (
              <TitleRow
                key={title.id}
                item={{ title, entry: catalog.index.franchisesByTitle.get(title.id)?.[0]?.entry, position: i + 1 }}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
