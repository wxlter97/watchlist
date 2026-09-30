import { SectionLabel } from "../../components/ui";
import { franchiseMetaById } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { useSession } from "../../lib/session";
import { publicShareUrl } from "../../lib/shares";
import { deleteShare, setShareRevoked, useSharesStore } from "../../lib/sharesStore";
import { showToast } from "../../lib/toasts";

/** Links públicos de la cuenta: copiar, revocar, reactivar o borrar (SPEC §9.5). */
export function SharesSection() {
  const { t, lang, loc, date } = useLang();
  const shares = useSharesStore((s) => s.shares);
  const profiles = useSession((s) => s.profiles);
  if (!shares.length) return null;

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast({ message: t("planner.copied") });
    } catch {
      showToast({ message: t("planner.copyFailed") });
    }
  };

  return (
    <section>
      <SectionLabel>{t("shareLink.yours")}</SectionLabel>
      <ul className="divide-y-2 divide-line-soft border-2 border-line bg-surface">
        {shares.map((share) => {
          const url = publicShareUrl(location.origin, share.id, lang);
          const franchise = franchiseMetaById.get(share.franchiseId);
          const profile = profiles.find((p) => p.id === share.profileId);
          return (
            <li key={share.id} className="p-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className={`min-w-0 truncate font-semibold ${share.revoked ? "text-muted line-through" : ""}`}>{share.title}</p>
                <span className="shrink-0 font-mono text-[10px] text-muted uppercase">{t(`shareLink.kinds.${share.kind}`)}</span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-muted">
                {franchise ? loc(franchise.name) : share.franchiseId}
                {profile && ` · ${profile.name}`} · {t("shareLink.updated", { date: date(share.updatedAt.slice(0, 10)) })}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {share.revoked ? (
                  <button type="button" className="text-link uppercase" onClick={() => setShareRevoked(share.id, false)}>
                    {t("shareLink.reactivate")}
                  </button>
                ) : (
                  <>
                    <button type="button" className="text-link uppercase" onClick={() => void copy(url)}>
                      {t("planner.copyLink")}
                    </button>
                    <a href={url} target="_blank" rel="noopener" className="text-link uppercase">
                      {t("shareLink.open")}
                    </a>
                    <button type="button" className="text-link text-alerta uppercase" onClick={() => setShareRevoked(share.id, true)}>
                      {t("shareLink.revoke")}
                    </button>
                  </>
                )}
                <button type="button" className="text-link text-alerta uppercase" onClick={() => deleteShare(share.id)}>
                  {t("account.delete")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
