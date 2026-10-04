import { useEffect } from "react";
import { Link } from "react-router";
import { useLang } from "../lib/i18n";
import { applyMeta } from "../lib/meta";

/** Ruta que no existe: no se indexa y lleva de vuelta al inicio (antes mostraba la portada). */
export function NotFound() {
  const { t } = useLang();
  useEffect(() => applyMeta({ title: t("meta.notFound"), noindex: true }, t("meta.siteDescription")), [t]);
  return (
    <div className="py-16">
      <h1 className="display text-[39px]">{t("notFound.title")}</h1>
      <p className="mt-3 max-w-[58ch] leading-[1.55] text-fg-soft">{t("notFound.body")}</p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center border-2 border-tinta bg-faro px-5 py-2.5 text-[15px] font-bold text-tinta transition-colors duration-[120ms] ease-out hover:bg-tinta hover:text-faro"
      >
        {t("notFound.home")}
      </Link>
    </div>
  );
}
