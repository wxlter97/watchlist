import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { accentStyle, Button, Notice, SectionLabel, SelectField, TextField } from "../../components/ui";
import { catalogIndex } from "../../lib/catalog";
import { groupTitles } from "../../lib/groups";
import { createGroup, useGroupsStore } from "../../lib/groupsStore";
import { useLang } from "../../lib/i18n";
import { useSession } from "../../lib/session";

export function GroupsPage() {
  const { t } = useLang();
  const status = useSession((s) => s.status);

  return (
    <div className="space-y-10 pt-6">
      <div>
        <h1 className="display text-[39px]">{t("groups.title")}</h1>
        <p className="mt-3 max-w-[58ch] leading-[1.55] text-fg-soft">{t("groups.intro")}</p>
      </div>
      {status === "signedIn" ? (
        <>
          <GroupList />
          <CreateGroup />
        </>
      ) : (
        <Notice>
          <p>{t("groups.signIn")}</p>
          <Link to="/account" className="text-link mt-2 inline-block uppercase">
            {t("account.signIn")}
          </Link>
        </Notice>
      )}
    </div>
  );
}

function GroupList() {
  const { t, loc } = useLang();
  const groups = useGroupsStore((s) => s.groups);
  const loaded = useGroupsStore((s) => s.loaded);
  if (!loaded) return null;

  return (
    <section>
      <SectionLabel>{t("groups.yours")}</SectionLabel>
      {groups.length === 0 ? (
        <p className="border-2 border-dashed border-line-soft p-6 text-center text-muted">{t("groups.none")}</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => {
            const franchise = catalogIndex.franchisesById.get(g.franchiseId);
            const route = g.routeId ? franchise?.routes.find((r) => r.id === g.routeId) : undefined;
            return (
              <li key={g.id} style={franchise ? accentStyle(franchise.accentColor) : undefined}>
                <Link to={`/groups/${g.id}`} className="group block border-2 border-line bg-surface">
                  <div className="h-2 border-b-2 border-line bg-accent" />
                  <div className="p-3.5">
                    <p className="font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">{g.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted uppercase">
                      {route ? loc(route.name) : franchise ? loc(franchise.name) : g.franchiseId} ·{" "}
                      {t("groups.members", { count: g.memberUids.length })}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CreateGroup() {
  const { t, loc } = useLang();
  const navigate = useNavigate();
  const user = useSession((s) => s.user)!;
  const profile = useSession((s) => s.profiles.find((p) => p.id === s.activeProfileId));
  const franchises = [...catalogIndex.franchisesById.values()];
  const [name, setName] = useState("");
  const [franchiseId, setFranchiseId] = useState(franchises[0]!.id);
  const [routeId, setRouteId] = useState("");
  const franchise = catalogIndex.franchisesById.get(franchiseId)!;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !profile) return;
    const id = createGroup({ uid: user.uid, profileId: profile.id, name: profile.name }, { name, franchiseId, routeId: routeId || undefined });
    navigate(`/groups/${id}`);
  };

  return (
    <section>
      <SectionLabel>{t("groups.create")}</SectionLabel>
      <form onSubmit={submit} className="space-y-4 border-2 border-line bg-surface p-3.5">
        <TextField label={t("groups.name")} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required />
        <SelectField
          label={t("groups.target")}
          value={franchiseId}
          options={franchises.map((f) => ({ value: f.id, label: loc(f.name) }))}
          onChange={(e) => {
            setFranchiseId(e.target.value);
            setRouteId("");
          }}
        />
        <SelectField
          label={t("routes.title")}
          value={routeId}
          options={[{ value: "", label: t("groups.wholeFranchise") }, ...franchise.routes.map((r) => ({ value: r.id, label: loc(r.name) }))]}
          onChange={(e) => setRouteId(e.target.value)}
        />
        <p className="text-xs text-fg-soft">
          {t("groups.targetHint", { count: groupTitles({ franchiseId, routeId: routeId || undefined }, catalogIndex).length, profile: profile?.name ?? "" })}
        </p>
        <Button type="submit" variant="primary" disabled={!name.trim() || !profile}>
          {t("groups.createAction")}
        </Button>
      </form>
    </section>
  );
}
