import { Link } from "react-router";
import { Button } from "../../components/ui";
import { CONSENT_NEEDED, setConsent, useConsent } from "../../lib/consent";
import { useLang } from "../../lib/i18n";

interface Section {
  h: string;
  p: string[];
}

/** /privacy y /terms: texto en locales/{es,en}.json (legal.privacy, legal.terms). */
function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const { t } = useLang();
  const sections = t(`legal.${kind}.sections`, { returnObjects: true }) as unknown as Section[];
  const consent = useConsent((s) => s.consent);

  return (
    <article className="max-w-[68ch] space-y-6 pt-6">
      <Link to="/" className="label inline-block border-b-2 border-current pb-0.5 font-bold">
        {t("legal.back")}
      </Link>
      <h1 className="display text-[39px] [text-wrap:balance]">{t(`legal.${kind}.title`)}</h1>
      <p className="font-mono text-[11px] text-muted uppercase">{t("legal.updated")}</p>
      {sections.map((s) => (
        <section key={s.h} className="space-y-2">
          <h2 className="display text-[22px]">{s.h}</h2>
          {s.p.map((text) => (
            <p key={text} className="leading-[1.6] text-fg-soft">
              {text}
            </p>
          ))}
        </section>
      ))}
      {kind === "privacy" && CONSENT_NEEDED && (
        <section className="space-y-2">
          <h2 className="display text-[22px]">{t("legal.privacy.adsChoice")}</h2>
          <p className="text-fg-soft">{consent === "granted" ? t("consent.accept") : consent === "denied" ? t("consent.reject") : "—"}</p>
          <Button onClick={() => setConsent(undefined)}>{t("legal.privacy.adsReset")}</Button>
        </section>
      )}
    </article>
  );
}

export const PrivacyPage = () => <LegalPage kind="privacy" />;
export const TermsPage = () => <LegalPage kind="terms" />;
