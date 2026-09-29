import { useState } from "react";
import { Link } from "react-router";
import { catalogIndex } from "../lib/catalog";
import { useLang } from "../lib/i18n";
import { useProgressStore } from "../lib/progressStore";
import { useSession } from "../lib/session";
import { buildSnapshot, publicShareUrl, type ShareDoc, type ShareTarget } from "../lib/shares";
import { publishShare, setShareRevoked } from "../lib/sharesStore";
import { showToast } from "../lib/toasts";
import { Modal } from "./ConfirmDialog";
import { Button } from "./ui";

/** Publica (o actualiza) un link público de solo lectura y muestra cómo compartirlo. */
export function ShareLinkButton({ target, title, label }: { target: ShareTarget; title: string; label: string }) {
  const { t, lang } = useLang();
  const user = useSession((s) => s.user);
  const profile = useSession((s) => s.profiles.find((p) => p.id === s.activeProfileId));
  const [share, setShare] = useState<ShareDoc | null>(null);

  const publish = () => {
    if (!user || !profile) return;
    const { progress, franchiseState } = useProgressStore.getState();
    const snapshot = buildSnapshot(target, { index: catalogIndex, progress, franchiseState });
    if (!snapshot) return;
    setShare(publishShare({ uid: user.uid, profileId: profile.id, name: profile.name }, target, { title, lang, snapshot }));
  };

  if (!user) {
    return (
      <Link to="/account" className="text-link font-mono text-[11px] uppercase" title={t("shareLink.signInHint")}>
        {label}
      </Link>
    );
  }

  const url = share ? publicShareUrl(location.origin, share.id, lang) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast({ message: t("planner.copied") });
    } catch {
      showToast({ message: t("planner.copyFailed") });
    }
  };

  return (
    <>
      <button type="button" onClick={publish} className="text-link font-mono text-[11px] uppercase">
        {label}
      </button>
      <Modal open={Boolean(share)} title={label} onClose={() => setShare(null)}>
        <p className="text-sm leading-[1.55] text-fg-soft">{t("shareLink.hint")}</p>
        <p className="border-2 border-line-soft bg-surface-muted px-2.5 py-2 font-mono text-[12px] break-all">{url}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void copy()}>
            {t("planner.copyLink")}
          </Button>
          {typeof navigator.share === "function" && (
            <Button onClick={() => void navigator.share({ title, url }).catch(() => undefined)}>{t("share.share")}</Button>
          )}
          <Button onClick={() => setShare(null)}>{t("common.close")}</Button>
        </div>
        <button
          type="button"
          className="text-link text-alerta uppercase"
          onClick={() => {
            if (share) setShareRevoked(share.id, true);
            setShare(null);
            showToast({ message: t("shareLink.revoked") });
          }}
        >
          {t("shareLink.revoke")}
        </button>
      </Modal>
    </>
  );
}
