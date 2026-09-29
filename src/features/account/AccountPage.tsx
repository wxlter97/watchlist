import { useState, type FormEvent } from "react";
import { Button, Notice, SectionLabel, TextField } from "../../components/ui";
import type { Profile } from "../../lib/cloud";
import { useLang } from "../../lib/i18n";
import { DataSection, NotificationsSection, Preferences } from "./SettingsSections";
import { SharesSection } from "./SharesSection";
import {
  createProfile,
  deleteProfile,
  renameProfile,
  selectProfile,
  signIn,
  signOut,
  useSession,
} from "../../lib/session";

export function AccountPage() {
  const { t } = useLang();
  const status = useSession((s) => s.status);

  return (
    <div className="space-y-10 pt-6">
      <h1 className="display text-[39px]">{t("account.title")}</h1>
      {status === "signedIn" ? (
        <>
          <SignedInCard />
          <Profiles />
          <SharesSection />
        </>
      ) : (
        <GuestCard loading={status === "loading"} />
      )}
      <Preferences />
      <NotificationsSection />
      <DataSection />
    </div>
  );
}

function AuthError() {
  const { t } = useLang();
  const code = useSession((s) => s.authError);
  if (!code) return null;
  return (
    <Notice tone="error">
      <p>{t("account.signInError", { code })}</p>
    </Notice>
  );
}

function GuestCard({ loading }: { loading: boolean }) {
  const { t } = useLang();
  return (
    <section className="space-y-4">
      <div className="border-2 border-line bg-surface">
        <div className="label border-b-2 border-line bg-faro px-3.5 py-2.5 font-bold text-tinta">{t("account.guest")}</div>
        <div className="space-y-4 p-4">
          <p className="max-w-[58ch] leading-[1.55] text-fg-soft">{t("account.guestBody")}</p>
          <Button variant="primary" disabled={loading} onClick={() => void signIn()}>
            {t("account.signIn")}
          </Button>
        </div>
      </div>
      <AuthError />
    </section>
  );
}

function SignedInCard() {
  const { t } = useLang();
  const user = useSession((s) => s.user)!;
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSignOut = async (force: boolean) => {
    setBusy(true);
    const result = await signOut(force);
    if (result === "pending") setPending(true);
    setBusy(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4 border-2 border-line bg-surface p-4">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="size-12 border-2 border-line" />
        ) : (
          <span className="display grid size-12 place-items-center border-2 border-line bg-faro text-2xl text-tinta">
            {user.displayName[0]}
          </span>
        )}
        <div className="min-w-0">
          <p className="label text-muted">{t("account.signedInAs")}</p>
          <p className="truncate font-semibold">{user.displayName}</p>
          {user.email && <p className="truncate font-mono text-xs text-muted">{user.email}</p>}
        </div>
      </div>
      {pending ? (
        <Notice tone="error">
          <p>{t("account.signOutPending")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" disabled={busy} onClick={() => void handleSignOut(true)}>
              {t("account.signOutAnyway")}
            </Button>
            <Button onClick={() => setPending(false)}>{t("common.cancel")}</Button>
          </div>
        </Notice>
      ) : (
        <Button disabled={busy} onClick={() => void handleSignOut(false)}>
          {t("account.signOut")}
        </Button>
      )}
    </section>
  );
}

function Profiles() {
  const { t } = useLang();
  const profiles = useSession((s) => s.profiles);
  const activeId = useSession((s) => s.activeProfileId);
  const [name, setName] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProfile(name);
    setName("");
  };

  return (
    <section>
      <SectionLabel>{t("account.profiles")}</SectionLabel>
      <p className="mb-4 max-w-[58ch] text-sm leading-[1.55] text-fg-soft">{t("account.profilesHint")}</p>
      <ul className="space-y-3">
        {profiles.map((p) => (
          <ProfileRow key={p.id} profile={p} active={p.id === activeId} canDelete={profiles.length > 1} />
        ))}
      </ul>
      <form onSubmit={submit} className="mt-4 flex items-end gap-2">
        <TextField
          label={t("account.newProfile")}
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          {t("account.create")}
        </Button>
      </form>
    </section>
  );
}

function ProfileRow({ profile, active, canDelete }: { profile: Profile; active: boolean; canDelete: boolean }) {
  const { t } = useLang();
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const [name, setName] = useState(profile.name);
  const [deleting, setDeleting] = useState(false);

  return (
    <li className={`border-2 bg-surface ${active ? "border-line" : "border-line-soft"}`}>
      <div className="flex items-center gap-3 p-3">
        <span
          aria-hidden
          className={`display grid size-10 shrink-0 place-items-center border-2 border-line text-xl ${active ? "bg-faro text-tinta" : ""}`}
        >
          {profile.avatar}
        </span>
        <p className="min-w-0 flex-1 truncate font-semibold">{profile.name}</p>
        {active ? (
          <span className="label border-2 border-tinta bg-faro px-2 py-1 font-bold text-tinta">{t("account.active")}</span>
        ) : (
          <Button onClick={() => selectProfile(profile.id)}>{t("account.use")}</Button>
        )}
      </div>

      {mode === "view" && (
        <div className="flex gap-4 border-t-2 border-line-soft px-3 py-2">
          <button type="button" className="text-link uppercase" onClick={() => setMode("rename")}>
            {t("account.rename")}
          </button>
          {canDelete && (
            <button type="button" className="text-link text-alerta uppercase" onClick={() => setMode("delete")}>
              {t("account.delete")}
            </button>
          )}
        </div>
      )}

      {mode === "rename" && (
        <form
          className="flex items-end gap-2 border-t-2 border-line-soft p-3"
          onSubmit={(e) => {
            e.preventDefault();
            renameProfile(profile.id, name);
            setMode("view");
          }}
        >
          <TextField label={t("account.name")} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} className="flex-1" autoFocus />
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            {t("common.save")}
          </Button>
        </form>
      )}

      {mode === "delete" && (
        <div className="border-t-2 border-line-soft p-3">
          <Notice tone="error">
            <p>{t("account.deleteConfirm", { name: profile.name })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="danger"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  await deleteProfile(profile.id).catch((err) => console.error(err));
                  setDeleting(false);
                  setMode("view");
                }}
              >
                {t("account.deleteYes")}
              </Button>
              <Button onClick={() => setMode("view")}>{t("common.cancel")}</Button>
            </div>
          </Notice>
        </div>
      )}
    </li>
  );
}
