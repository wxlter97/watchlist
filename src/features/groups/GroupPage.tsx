import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { accentStyle, Button, Notice, Poster, SectionLabel } from "../../components/ui";
import { catalogIndex } from "../../lib/catalog";
import { groupTitles, inviteUrl, memberCounts, nextTogether, type GroupDoc } from "../../lib/groups";
import { deleteGroup, regenerateInvite, removeMember, setWatchedTogether, useGroupProgress, useGroupsStore } from "../../lib/groupsStore";
import { useLang } from "../../lib/i18n";
import { isReleased, todayIso } from "../../lib/progress";
import { selectProfile, useSession } from "../../lib/session";
import { showToast } from "../../lib/toasts";

export function GroupPage() {
  const { groupId } = useParams();
  const { t } = useLang();
  const group = useGroupsStore((s) => s.groups.find((g) => g.id === groupId));
  const loaded = useGroupsStore((s) => s.loaded);
  if (!group) {
    return <p className="py-16 text-center text-muted">{loaded ? t("groups.notFound") : "…"}</p>;
  }
  return <GroupDetail group={group} />;
}

function GroupDetail({ group }: { group: GroupDoc }) {
  const { t, loc, name } = useLang();
  const navigate = useNavigate();
  const uid = useSession((s) => s.user?.uid)!;
  const activeProfileId = useSession((s) => s.activeProfileId);
  const profiles = useSession((s) => s.profiles);
  const progress = useGroupProgress(group.id);
  const [confirm, setConfirm] = useState<"leave" | "delete" | { remove: string } | null>(null);
  const franchise = catalogIndex.franchisesById.get(group.franchiseId);
  const route = group.routeId ? franchise?.routes.find((r) => r.id === group.routeId) : undefined;
  const titles = useMemo(() => groupTitles(group, catalogIndex), [group]);
  const released = titles.filter((t) => isReleased(t));
  const counts = memberCounts(released, progress, group.memberUids);
  const next = nextTogether(titles, progress, group.memberUids, todayIso());
  const isOwner = group.ownerUid === uid;
  const myProfile = group.members[uid];
  const initials = (u: string) => (group.memberNames[u] ?? "?").slice(0, 2).toUpperCase();
  const link = inviteUrl(location.origin, group.id, group.inviteCode);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast({ message: t("planner.copied") });
    } catch {
      showToast({ message: t("planner.copyFailed") });
    }
  };

  return (
    <div style={franchise ? accentStyle(franchise.accentColor) : undefined}>
      <header className="-mx-4 border-b-2 border-line bg-accent px-4 pt-5 pb-8 text-on-accent">
        <Link to="/groups" className="label inline-block border-b-2 border-current pb-0.5 font-bold">
          ← {t("groups.title")}
        </Link>
        <h1 className="display mt-6 text-[39px] [text-wrap:balance]">{group.name}</h1>
        <p className="label mt-2 font-bold">{route ? loc(route.name) : franchise ? loc(franchise.name) : ""}</p>
      </header>

      {myProfile && myProfile !== activeProfileId && (
        <div className="mt-6">
          <Notice>
            <p>{t("groups.otherProfile", { profile: profiles.find((p) => p.id === myProfile)?.name ?? "—" })}</p>
            <Button className="mt-3" onClick={() => selectProfile(myProfile)}>
              {t("groups.switchProfile")}
            </Button>
          </Notice>
        </div>
      )}

      <section className="mt-6">
        <SectionLabel>{t("groups.membersTitle")}</SectionLabel>
        <ul className="divide-y-2 divide-line-soft border-2 border-line bg-surface">
          {group.memberUids.map((u) => (
            <li key={u} className="flex items-center gap-3 p-3">
              <span className="display grid size-10 shrink-0 place-items-center border-2 border-line bg-faro text-sm text-tinta">{initials(u)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {group.memberNames[u] ?? u}
                  {u === uid && <span className="ml-2 font-mono text-[10px] text-muted uppercase">{t("groups.you")}</span>}
                  {u === group.ownerUid && <span className="ml-2 font-mono text-[10px] text-muted uppercase">{t("groups.owner")}</span>}
                </p>
                <p className="font-mono text-[11px] text-muted uppercase">{t("progress.count", { watched: counts[u] ?? 0, total: released.length })}</p>
              </div>
              {isOwner && u !== uid && (
                <button type="button" className="text-link text-alerta uppercase" onClick={() => setConfirm({ remove: u })}>
                  {t("groups.remove")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <SectionLabel>{t("groups.nextTogether")}</SectionLabel>
        {next ? (
          <div className="flex items-center gap-3 border-2 border-line bg-surface p-3">
            <Link to={`/t/${next.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
              <Poster title={next} size="w154" className="h-24 w-16" />
              <div className="min-w-0">
                <p className="truncate font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">{name(next)}</p>
                <p className="mt-1 font-mono text-[11px] text-muted uppercase">
                  {group.memberUids.filter((u) => progress[next.id]?.watchedBy[u]).map((u) => group.memberNames[u]).join(", ") ||
                    t("groups.nobodyYet")}
                </p>
              </div>
            </Link>
            <Button variant="primary" onClick={() => setWatchedTogether(group.id, next.id, true, next.id in progress)}>
              {t("groups.watchedTogether")}
            </Button>
          </div>
        ) : (
          <p className="border-2 border-dashed border-line-soft p-5 text-center text-muted">{t("groups.allDone")}</p>
        )}
      </section>

      <section className="mt-8">
        <SectionLabel>{t("groups.titles")}</SectionLabel>
        <div className="overflow-x-auto border-2 border-line bg-surface">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-line">
                <th className="px-3 py-2 text-left font-mono text-[10px] font-normal text-muted uppercase">{t("groups.title_col")}</th>
                {group.memberUids.map((u) => (
                  <th key={u} scope="col" title={group.memberNames[u]} className="w-10 px-1 py-2 font-mono text-[10px] text-muted">
                    {initials(u)}
                  </th>
                ))}
                <th scope="col" className="w-16 px-2 py-2 font-mono text-[10px] font-normal text-muted uppercase">{t("groups.together")}</th>
              </tr>
            </thead>
            <tbody>
              {released.map((title) => {
                const doc = progress[title.id];
                return (
                  <tr key={title.id} className="border-b-2 border-line-soft last:border-b-0">
                    <th scope="row" className="max-w-[46vw] px-3 py-2 text-left font-normal sm:max-w-none">
                      <Link to={`/t/${title.id}`} className="block truncate hover:underline hover:decoration-2 hover:underline-offset-4">
                        {name(title)}
                      </Link>
                    </th>
                    {group.memberUids.map((u) => (
                      <td key={u} className="px-1 py-2 text-center">
                        <span
                          aria-label={`${group.memberNames[u]}: ${doc?.watchedBy[u] ? t("status.watched") : t("status.none")}`}
                          className={`inline-block size-4 border-2 border-line align-middle ${doc?.watchedBy[u] ? "bg-accent" : ""}`}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={Boolean(doc?.watchedTogether)}
                        aria-label={t("groups.togetherLabel", { title: name(title) })}
                        onChange={(e) => setWatchedTogether(group.id, title.id, e.target.checked, title.id in progress)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-fg-soft">{t("groups.syncHint")}</p>
      </section>

      <section className="mt-8">
        <SectionLabel>{t("groups.invite")}</SectionLabel>
        <div className="space-y-3 border-2 border-line bg-surface p-3.5">
          <p className="text-sm text-fg-soft">{t("groups.inviteHint")}</p>
          <p className="border-2 border-line-soft bg-surface-muted px-2.5 py-2 font-mono text-[12px] break-all">{link}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void copy()}>
              {t("planner.copyLink")}
            </Button>
            {typeof navigator.share === "function" && (
              <Button onClick={() => void navigator.share({ title: group.name, url: link }).catch(() => undefined)}>{t("share.share")}</Button>
            )}
            {isOwner && <Button onClick={() => regenerateInvite(group.id)}>{t("groups.newCode")}</Button>}
          </div>
        </div>
      </section>

      <section className="mt-8">
        {isOwner ? (
          <Button variant="danger" onClick={() => setConfirm("delete")}>
            {t("groups.delete")}
          </Button>
        ) : (
          <Button variant="danger" onClick={() => setConfirm("leave")}>
            {t("groups.leave")}
          </Button>
        )}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? t("groups.delete") : confirm === "leave" ? t("groups.leave") : t("groups.remove")}
        confirmLabel={confirm === "delete" ? t("groups.delete") : confirm === "leave" ? t("groups.leave") : t("groups.remove")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === "delete") {
            void deleteGroup(group.id).catch((err) => console.error(err));
            navigate("/groups", { replace: true });
          } else if (confirm === "leave") {
            removeMember(group.id, uid);
            navigate("/groups", { replace: true });
          } else if (confirm) {
            removeMember(group.id, confirm.remove);
          }
          setConfirm(null);
        }}
      >
        <p>
          {confirm === "delete"
            ? t("groups.deleteConfirm", { name: group.name })
            : confirm === "leave"
              ? t("groups.leaveConfirm", { name: group.name })
              : confirm
                ? t("groups.removeConfirm", { name: group.memberNames[confirm.remove] ?? "" })
                : null}
        </p>
      </ConfirmDialog>
    </div>
  );
}
