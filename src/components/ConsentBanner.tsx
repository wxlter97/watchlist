import { Link } from "react-router";
import { ADS_ENABLED, CONSENT_NEEDED, setConsent, useConsent } from "../lib/consent";
import { useLang } from "../lib/i18n";
import { Button } from "./ui";

/** Aviso de anuncios: solo aparece si hay anuncios configurados y aún no se eligió. */
export function ConsentBanner() {
  const { t } = useLang();
  const consent = useConsent((s) => s.consent);
  if (!CONSENT_NEEDED || consent) return null;
  return (
    <div role="dialog" aria-label={t("legal.privacy.adsChoice")} className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-sm leading-[1.5]">
          {t(ADS_ENABLED ? "consent.textAds" : "consent.textAnalytics")}{" "}
          <Link to="/privacy" className="underline">
            {t("legal.privacyLink")}
          </Link>
        </p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setConsent("granted")}>
            {t("consent.accept")}
          </Button>
          <Button onClick={() => setConsent("denied")}>{t("consent.reject")}</Button>
        </div>
      </div>
    </div>
  );
}
