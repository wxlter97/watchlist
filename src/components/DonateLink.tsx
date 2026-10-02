import { DONATE_URL } from "../lib/donate";
import { useLang } from "../lib/i18n";

/** "Invítame un café": enlace externo para apoyar el proyecto con el monto que la persona elija. */
export function DonateLink({ variant = "link" }: { variant?: "link" | "card" }) {
  const { t } = useLang();
  if (!DONATE_URL) return null;

  if (variant === "link") {
    return (
      <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 self-start font-bold text-fg underline">
        <span aria-hidden>☕</span>
        {t("donate.cta")}
      </a>
    );
  }
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-line bg-surface p-4">
        <div className="min-w-0 max-w-[52ch]">
          <p className="font-semibold">{t("donate.title")}</p>
          <p className="mt-1 text-sm text-fg-soft">{t("donate.body")}</p>
        </div>
        <a
          href={DONATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 border-2 border-tinta bg-faro px-5 py-2.5 text-[15px] font-bold text-tinta transition-colors duration-[120ms] ease-out hover:bg-tinta hover:text-faro"
        >
          <span aria-hidden>☕</span>
          {t("donate.cta")} ↗
        </a>
      </div>
    </section>
  );
}
