import { useEffect } from "react";
import { useRouteError } from "react-router";
import { useLang } from "../lib/i18n";
import { reportError } from "../lib/errorReport";
import { Button } from "./ui";

/** Pantalla de error de la app (errorElement del router): registra el error y deja recargar. */
export function RouteError() {
  const { t } = useLang();
  const error = useRouteError();
  useEffect(() => reportError("render", error), [error]);
  return (
    <div role="alert" className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-4">
      <h1 className="display text-[39px]">{t("errors.title")}</h1>
      <p className="max-w-[58ch] leading-[1.55] text-fg-soft">{t("errors.body")}</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => location.reload()}>
          {t("errors.reload")}
        </Button>
        <Button onClick={() => location.assign("/")}>{t("errors.home")}</Button>
      </div>
    </div>
  );
}
