import { Link } from "react-router";
import { SectionLabel } from "../../components/ui";
import { useCatalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { useIsWatched } from "../../lib/watched";
import { resolveRoute, ROUTE_KINDS, routeProgress } from "../../lib/routes";
import type { Franchise, Route } from "../../lib/types";

export function RoutesSection({ franchise }: { franchise: Franchise }) {
  const { t } = useLang();
  if (franchise.routes.length === 0) return null;

  return (
    <section className="mt-10">
      <SectionLabel>{t("routes.title")}</SectionLabel>
      <div className="space-y-6">
        {ROUTE_KINDS.map((kind) => {
          const routes = franchise.routes.filter((r) => r.kind === kind);
          if (!routes.length) return null;
          return (
            <div key={kind}>
              <h3 className="display mb-3 text-[20px]">{t(`routes.kinds.${kind}`)}</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {routes.map((r) => (
                  <li key={r.id}>
                    <RouteCard franchise={franchise} route={r} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RouteCard({ franchise, route }: { franchise: Franchise; route: Route }) {
  const { t, loc } = useLang();
  const isWatched = useIsWatched();
  const index = useCatalogIndex();
  const progress = routeProgress(resolveRoute(route, franchise, index), isWatched);
  const done = progress.watched === progress.total;

  return (
    <Link
      to={`/f/${franchise.id}/r/${route.id}`}
      className="group flex h-full flex-col border-2 border-line bg-surface transition-colors duration-[120ms] ease-out hover:bg-surface-muted"
    >
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <p className="font-semibold leading-snug group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
          {loc(route.name)}
        </p>
        <p className="line-clamp-2 text-sm leading-[1.5] text-fg-soft">{loc(route.description)}</p>
      </div>
      <div className="flex items-center justify-between border-t-2 border-line-soft px-3.5 py-2 font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
        <span>{t("routes.count", { count: progress.total })}</span>
        <span className={done ? "font-bold text-fg" : ""}>
          {done ? t("routes.done") : t("progress.count", { watched: progress.watched, total: progress.total })}
        </span>
      </div>
    </Link>
  );
}
