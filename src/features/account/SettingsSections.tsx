import { useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Button, Notice, SectionLabel, SelectField, Tabs, Toggle } from "../../components/ui";
import { useAchievementsStore } from "../../lib/achievementsStore";
import { backupFileName, buildBackup, buildFullExport, fullExportFileName, parseBackup } from "../../lib/backup";
import { usePlansStore } from "../../lib/plansStore";
import { LANGS, useLang } from "../../lib/i18n";
import { planMigration } from "../../lib/migrate";
import { useProgressStore, type ProgressData } from "../../lib/progressStore";
import { useSession } from "../../lib/session";
import { disablePush, enablePush, hasPushToken, pushSupport, type PushSupport } from "../../lib/push";
import { setExternalLink, setNotification, updateSettings, useSettings, type ExternalLinks, type NotificationSettings } from "../../lib/settings";
import { setTheme, useTheme } from "../../lib/theme";
import { showToast } from "../../lib/toasts";

// Regiones con datos de "dónde ver" en TMDB/JustWatch más relevantes para la app.
const REGIONS = [
  "AR", "BO", "BR", "CA", "CL", "CO", "CR", "DE", "DO", "EC", "ES", "FR", "GB", "GT", "HN", "IT",
  "MX", "NI", "PA", "PE", "PR", "PT", "PY", "SV", "US", "UY", "VE",
];

/**
 * Baja un JSON. El enlace va en la página y la URL se libera un poco después: con el enlace suelto o
 * liberada al instante, algunos navegadores pierden la descarga.
 */
function downloadJson(data: unknown, fileName: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3">
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-[1.5] text-fg-soft">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function Preferences() {
  const { t, lang, setLang } = useLang();
  const theme = useTheme();
  const settings = useSettings();
  const regionNames = new Intl.DisplayNames([t("meta.locale")], { type: "region" });
  const regions = REGIONS.map((code) => ({ value: code, label: regionNames.of(code) ?? code })).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  const links: { key: keyof ExternalLinks; label: string; hint?: string }[] = [
    { key: "letterboxd", label: "Letterboxd" },
    { key: "imdb", label: "IMDb" },
    { key: "trakt", label: "Trakt" },
    { key: "letterboxdToast", label: t("settings.letterboxdToast"), hint: t("settings.letterboxdToastHint") },
  ];

  return (
    <>
      <section>
        <SectionLabel>{t("account.preferences")}</SectionLabel>
        <div className="divide-y-2 divide-line-soft border-2 border-line bg-surface">
          <Row label={t("nav.language")}>
            <Tabs
              size="sm"
              label={t("nav.language")}
              value={lang}
              options={LANGS.map((l) => ({ value: l, label: l === "es" ? "Español" : "English" }))}
              onChange={setLang}
            />
          </Row>
          <Row label={t("nav.darkMode")}>
            <Toggle checked={theme === "dark"} label={t("nav.darkMode")} onChange={(dark) => setTheme(dark ? "dark" : "light")} />
          </Row>
          <Row label={t("settings.spoilerFree")} hint={t("settings.spoilerFreeHint")}>
            <Toggle checked={settings.spoilerFree} label={t("settings.spoilerFree")} onChange={(v) => updateSettings({ spoilerFree: v })} />
          </Row>
          <div className="p-3">
            <SelectField
              label={t("settings.region")}
              value={settings.streamingRegion}
              options={regions}
              onChange={(e) => updateSettings({ streamingRegion: e.target.value })}
            />
            <p className="mt-1.5 text-xs text-fg-soft">{t("settings.regionHint")}</p>
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>{t("external.title")}</SectionLabel>
        <div className="divide-y-2 divide-line-soft border-2 border-line bg-surface">
          {links.map((l) => (
            <Row key={l.key} label={l.label} hint={l.hint}>
              <Toggle checked={settings.externalLinks[l.key]} label={l.label} onChange={(v) => setExternalLink(l.key, v)} />
            </Row>
          ))}
        </div>
      </section>
    </>
  );
}

export function DataSection() {
  const { t } = useLang();
  const profileName = useSession((s) => s.profiles.find((p) => p.id === s.activeProfileId)?.name) ?? t("account.guest");
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: ProgressData; profile: string; skipped: number } | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [error, setError] = useState<string | null>(null);

  const exportData = () => {
    const { progress, franchiseState } = useProgressStore.getState();
    downloadJson(buildBackup(profileName, { progress, franchiseState }), backupFileName(profileName));
  };

  const exportEverything = () => {
    const { progress, franchiseState } = useProgressStore.getState();
    const { user } = useSession.getState();
    const everything = buildFullExport(profileName, {
      progress,
      franchiseState,
      plans: usePlansStore.getState().plans,
      achievements: useAchievementsStore.getState().unlocked,
      settings: useSettings.getState(),
      account: user ? { name: user.displayName, email: user.email } : null,
    });
    downloadJson(everything, fullExportFileName(profileName));
  };

  const readFile = async (file: File) => {
    setError(null);
    const result = parseBackup(await file.text());
    if (!result.ok) return setError(t(`backup.errors.${result.error}`));
    setMode("merge");
    setPending(result);
  };

  const applyImport = () => {
    if (!pending) return;
    const store = useProgressStore.getState();
    const before = { progress: { ...store.progress }, franchiseState: { ...store.franchiseState } };
    if (mode === "merge") {
      // Gana el cambio más reciente por documento, igual que la migración de invitado.
      const plan = planMigration(pending.data, before);
      store.applyMany(Object.fromEntries(plan.progress));
      store.applyFranchiseStates(Object.fromEntries(plan.franchiseState));
    } else {
      const removed = Object.keys(before.progress).filter((id) => !(id in pending.data.progress));
      store.applyMany({ ...Object.fromEntries(removed.map((id) => [id, null])), ...pending.data.progress });
      store.applyFranchiseStates(pending.data.franchiseState);
    }
    showToast({
      message: t("backup.imported"),
      action: {
        label: t("upTo.undo"),
        onClick: () => {
          const now = useProgressStore.getState().progress;
          const added = Object.keys(now).filter((id) => !(id in before.progress));
          useProgressStore.getState().applyMany({ ...Object.fromEntries(added.map((id) => [id, null])), ...before.progress });
          useProgressStore.getState().applyFranchiseStates(before.franchiseState);
        },
      },
      duration: 10_000,
    });
    setPending(null);
  };

  return (
    <section>
      <SectionLabel>{t("backup.title")}</SectionLabel>
      <div className="space-y-3 border-2 border-line bg-surface p-3.5">
        <p className="text-sm leading-[1.55] text-fg-soft">{t("backup.hint", { profile: profileName })}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportData}>{t("backup.export")}</Button>
          <Button onClick={() => fileInput.current?.click()}>{t("backup.import")}</Button>
          <Button onClick={exportEverything}>{t("backup.exportAll")}</Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void readFile(file);
            }}
          />
        </div>
        <p className="text-xs leading-[1.5] text-fg-soft">{t("backup.exportAllHint")}</p>
        {error && (
          <Notice tone="error">
            <p>{error}</p>
          </Notice>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title={t("backup.import")}
        confirmLabel={t("backup.apply")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setPending(null)}
        onConfirm={applyImport}
      >
        {pending && (
          <div className="space-y-3">
            <p>
              {t("backup.summary", { count: Object.keys(pending.data.progress).length, profile: pending.profile || "—" })}
              {pending.skipped > 0 && ` ${t("backup.skipped", { count: pending.skipped })}`}
            </p>
            <Tabs
              label={t("backup.mode")}
              layout="grid grid-cols-2"
              value={mode}
              options={[
                { value: "merge", label: t("backup.merge") },
                { value: "replace", label: t("backup.replace") },
              ]}
              onChange={setMode}
            />
            <p className="text-sm text-fg-soft">{t(mode === "merge" ? "backup.mergeHint" : "backup.replaceHint", { profile: profileName })}</p>
          </div>
        )}
      </ConfirmDialog>
    </section>
  );
}

export function NotificationsSection() {
  const { t } = useLang();
  const uid = useSession((s) => s.user?.uid);
  const notifications = useSettings((s) => s.notifications);
  const [support, setSupport] = useState<PushSupport>(() => pushSupport());
  const [busy, setBusy] = useState(false);
  if (!uid) return null;

  const toggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (value && !hasPushToken()) {
      setBusy(true);
      const ok = await enablePush(uid).catch(() => false);
      setBusy(false);
      setSupport(pushSupport());
      if (!ok) return showToast({ message: t("notifications.notGranted") });
    }
    setNotification(key, value);
    const next = { ...notifications, [key]: value };
    if (!Object.values(next).some(Boolean)) void disablePush(uid);
  };

  const types: { key: keyof NotificationSettings; hint: string }[] = [
    { key: "releases", hint: t("notifications.releasesHint") },
    { key: "streamingAvailable", hint: t("notifications.streamingHint") },
    { key: "catalogUpdates", hint: t("notifications.catalogHint") },
  ];

  return (
    <section>
      <SectionLabel>{t("notifications.title")}</SectionLabel>
      {support !== "ok" && (
        <div className="mb-3">
          <Notice tone={support === "denied" ? "error" : "neutral"}>
            <p>{t(`notifications.support.${support}`)}</p>
          </Notice>
        </div>
      )}
      <div className="divide-y-2 divide-line-soft border-2 border-line bg-surface">
        {types.map(({ key, hint }) => (
          <Row key={key} label={t(`notifications.types.${key}`)} hint={hint}>
            <Toggle
              checked={notifications[key]}
              label={t(`notifications.types.${key}`)}
              onChange={(v) => {
                if (busy || (v && support !== "ok")) return;
                void toggle(key, v);
              }}
            />
          </Row>
        ))}
      </div>
      <p className="mt-2 text-xs text-fg-soft">{t("notifications.hint")}</p>
    </section>
  );
}
