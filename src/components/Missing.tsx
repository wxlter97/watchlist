import { useEffect } from "react";
import { Link } from "react-router";
import { useLang } from "../lib/i18n";
import { applyMeta } from "../lib/meta";

/** Algo que no existe (link mal escrito, borrado, de otra cuenta): dice qué pasó y a dónde ir. */
export function Missing({ message }: { message: string }) {
  const { t } = useLang();
  useEffect(() => applyMeta({ title: t("meta.notFound"), noindex: true }, t("meta.siteDescription")), [t]);
  return (
    <div className="py-16 text-center">
      <p className="mx-auto max-w-[52ch] leading-[1.55] text-fg-soft">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-4">
        <Link to="/" className="text-link uppercase">
          {t("notFound.home")}
        </Link>
        <Link to="/search" className="text-link uppercase">
          {t("search.title")}
        </Link>
      </div>
    </div>
  );
}
