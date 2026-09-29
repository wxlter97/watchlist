import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Button, Notice, SelectField } from "../../components/ui";
import { joinGroup, useGroupsStore } from "../../lib/groupsStore";
import { useLang } from "../../lib/i18n";
import { signIn, useSession } from "../../lib/session";

/** /join/:groupId?code=… — unirse a un grupo con el link de invitación. */
export function JoinPage() {
  const { groupId = "" } = useParams();
  const [params] = useSearchParams();
  const code = params.get("code") ?? "";
  const { t } = useLang();
  const navigate = useNavigate();
  const status = useSession((s) => s.status);
  const profiles = useSession((s) => s.profiles);
  const activeProfileId = useSession((s) => s.activeProfileId);
  const already = useGroupsStore((s) => s.groups.some((g) => g.id === groupId));
  const [profileId, setProfileId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = profiles.find((p) => p.id === (profileId ?? activeProfileId));

  const join = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const result = await joinGroup(groupId, code, chosen.id, chosen.name);
    setBusy(false);
    if (result === "ok") navigate(`/groups/${groupId}`, { replace: true });
    else setError(t(`groups.joinErrors.${result}`));
  };

  return (
    <div className="space-y-6 pt-6">
      <h1 className="display text-[39px]">{t("groups.joinTitle")}</h1>
      <p className="max-w-[58ch] leading-[1.55] text-fg-soft">{t("groups.joinIntro")}</p>
      {already ? (
        <Notice>
          <p>{t("groups.alreadyMember")}</p>
          <Link to={`/groups/${groupId}`} className="text-link mt-2 inline-block uppercase">
            {t("groups.open")}
          </Link>
        </Notice>
      ) : status !== "signedIn" ? (
        <Button variant="primary" disabled={status === "loading"} onClick={() => void signIn()}>
          {t("account.signIn")}
        </Button>
      ) : (
        <div className="space-y-4 border-2 border-line bg-surface p-3.5">
          {profiles.length > 1 && (
            <SelectField
              label={t("groups.joinAs")}
              value={chosen?.id ?? ""}
              options={profiles.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(e) => setProfileId(e.target.value)}
            />
          )}
          <p className="text-sm text-fg-soft">{t("groups.joinPrivacy", { profile: chosen?.name ?? "" })}</p>
          <Button variant="primary" disabled={busy || !chosen || !code} onClick={() => void join()}>
            {busy ? "…" : t("groups.joinAction")}
          </Button>
          {error && (
            <Notice tone="error">
              <p>{error}</p>
            </Notice>
          )}
        </div>
      )}
    </div>
  );
}
