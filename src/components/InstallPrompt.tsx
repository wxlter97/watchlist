import { useState } from "react";
import { dismissReminder, promptInstall, useInstall } from "../lib/install";
import { useLang } from "../lib/i18n";
import { Button, Notice } from "./ui";

/** Cómo instalarla donde el navegador no puede lanzar el diálogo (iPhone y iPad). */
function IosSteps() {
  const { t } = useLang();
  return <p className="mt-1.5 text-fg-soft">{t("install.ios")}</p>;
}

/** Recordatorio en la portada: solo si no está instalada y toca (ver `shouldRemind`). */
export function InstallReminder() {
  const { t } = useLang();
  const { kind, remind } = useInstall();
  const [steps, setSteps] = useState(false);
  if (!remind) return null;

  return (
    <div className="mt-6">
      <Notice>
        <p className="font-semibold">{t("install.title")}</p>
        <p className="mt-0.5 text-fg-soft">{t("install.body")}</p>
        {kind === "ios" && steps && <IosSteps />}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => (kind === "prompt" ? void promptInstall() : setSteps((v) => !v))}>
            {t("install.action")}
          </Button>
          <Button onClick={() => dismissReminder()}>{t("install.later")}</Button>
        </div>
      </Notice>
    </div>
  );
}

/** En Cuenta: siempre a mano mientras no esté instalada y el dispositivo pueda. */
export function InstallSection() {
  const { t } = useLang();
  const { kind } = useInstall();
  const [steps, setSteps] = useState(false);
  if (kind === "unavailable") return null;

  return (
    <section>
      <h2 className="sr-only">{t("install.section")}</h2>
      <div className="border-2 border-line bg-surface p-3">
        {kind === "installed" ? (
          <p className="font-semibold">✓ {t("install.installed")}</p>
        ) : (
          <>
            <p className="font-semibold">{t("install.title")}</p>
            <p className="mt-0.5 text-xs leading-[1.5] text-fg-soft">{t("install.body")}</p>
            {kind === "ios" && steps && <IosSteps />}
            <div className="mt-3">
              <Button variant="primary" onClick={() => (kind === "prompt" ? void promptInstall() : setSteps((v) => !v))}>
                {t("install.action")}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
