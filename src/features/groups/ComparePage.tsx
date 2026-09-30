import { onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { accentStyle, Notice, ProgressBar, SectionLabel, SelectField } from "../../components/ui";
import { paths } from "../../lib/cloud";
import { franchiseMetaById, franchiseMetas, useCatalog, withReferences } from "../../lib/catalog";
import { effectiveHidden } from "../../lib/filters";
import { db } from "../../lib/firebase";
import { useLang } from "../../lib/i18n";
import { computeOrder, resolveOrder } from "../../lib/orders";
import { isReleased } from "../../lib/progress";
import { useProgressStore, type ProgressDoc } from "../../lib/progressStore";
import { useSession } from "../../lib/session";

// Comparar progreso entre perfiles de la misma cuenta, lado a lado (SPEC §9.5). Con otras
// personas se compara dentro de un grupo.

function useProfileProgress(uid: string | undefined, pid: string | undefined) {
  const activeId = useSession((s) => s.activeProfileId);
  const active = useProgressStore((s) => s.progress);
  const [other, setOther] = useState<Record<string, ProgressDoc>>({});
  const isActive = pid === activeId;
  useEffect(() => {
    if (!uid || !pid || isActive) return;
    return onSnapshot(paths.progress(db, uid, pid), (snap) => setOther(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))));
  }, [uid, pid, isActive]);
  return isActive ? active : other;
}

export function ComparePage() {
  const { t, loc, name } = useLang();
  const uid = useSession((s) => s.user?.uid);
  const profiles = useSession((s) => s.profiles);
  const activeId = useSession((s) => s.activeProfileId);
  const franchises = franchiseMetas;
  const [a, setA] = useState<string | undefined>();
  const [b, setB] = useState<string | undefined>();
  const [franchiseId, setFranchiseId] = useState(franchises[0]!.id);
  const left = a ?? activeId;
  const right = b ?? profiles.find((p) => p.id !== left)?.id;
  const progressA = useProfileProgress(uid, left);
  const progressB = useProfileProgress(uid, right);
  const { index } = useCatalog(withReferences(franchiseId));
  const franchise = index.franchisesById.get(franchiseId);

  const titles = useMemo(() => {
    if (!franchise) return [];
    const order = resolveOrder(franchise, "release");
    return computeOrder(franchise, order, index.titlesById, { hiddenContinuities: effectiveHidden(franchise, undefined, undefined) })
      .map((i) => i.title)
      .filter((t, i, all) => isReleased(t) && all.findIndex((x) => x.id === t.id) === i);
  }, [franchise, index]);

  if (!uid || profiles.length < 2) {
    return (
      <div className="space-y-6 pt-6">
        <h1 className="display text-[39px]">{t("compare.title")}</h1>
        <Notice>
          <p>{t(uid ? "compare.needProfiles" : "compare.signIn")}</p>
          <div className="mt-2 flex gap-4">
            <Link to="/account" className="text-link uppercase">
              {t("account.title")}
            </Link>
            <Link to="/groups" className="text-link uppercase">
              {t("groups.title")}
            </Link>
          </div>
        </Notice>
      </div>
    );
  }

  const nameOf = (pid: string | undefined) => profiles.find((p) => p.id === pid)?.name ?? "—";
  const seen = (progress: Record<string, ProgressDoc>, id: string) => progress[id]?.status === "watched";
  const countA = titles.filter((x) => seen(progressA, x.id)).length;
  const countB = titles.filter((x) => seen(progressB, x.id)).length;
  const both = titles.filter((x) => seen(progressA, x.id) && seen(progressB, x.id)).length;
  const options = profiles.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="pt-6" style={accentStyle(franchiseMetaById.get(franchiseId)!.accentColor)}>
      <h1 className="display text-[39px]">{t("compare.title")}</h1>
      <p className="mt-3 max-w-[58ch] leading-[1.55] text-fg-soft">{t("compare.intro")}</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <SelectField label={t("compare.profileA")} value={left} options={options} onChange={(e) => setA(e.target.value)} />
        <SelectField label={t("compare.profileB")} value={right} options={options} onChange={(e) => setB(e.target.value)} />
      </div>
      <SelectField
        className="mt-3"
        label={t("franchise.label")}
        value={franchiseId}
        options={franchises.map((f) => ({ value: f.id, label: loc(f.name) }))}
        onChange={(e) => setFranchiseId(e.target.value)}
      />

      <section className="mt-6 grid grid-cols-2 gap-3">
        {[
          { pid: left, count: countA },
          { pid: right, count: countB },
        ].map(({ pid, count }, i) => (
          <div key={i} className="border-2 border-line bg-surface p-3">
            <p className="truncate font-semibold">{nameOf(pid)}</p>
            <p className="display mt-1 text-[31px] tabular-nums">
              {count}
              <span className="text-[16px] text-muted">/{titles.length}</span>
            </p>
            <div className="mt-2">
              <ProgressBar ratio={titles.length ? count / titles.length : 0} label={nameOf(pid)} />
            </div>
          </div>
        ))}
      </section>
      <p className="mt-2 font-mono text-[11px] text-muted uppercase">{t("compare.both", { count: both })}</p>

      <section className="mt-8">
        <SectionLabel>{t("groups.titles")}</SectionLabel>
        <table className="w-full border-collapse border-2 border-line bg-surface text-sm">
          <thead>
            <tr className="border-b-2 border-line">
              <th className="px-3 py-2 text-left font-mono text-[10px] font-normal text-muted uppercase">{t("groups.title_col")}</th>
              <th scope="col" className="w-20 truncate px-1 py-2 font-mono text-[10px] text-muted">{nameOf(left).slice(0, 8)}</th>
              <th scope="col" className="w-20 truncate px-1 py-2 font-mono text-[10px] text-muted">{nameOf(right).slice(0, 8)}</th>
            </tr>
          </thead>
          <tbody>
            {titles.map((title) => (
              <tr key={title.id} className="border-b-2 border-line-soft last:border-b-0">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <Link to={`/t/${title.id}`} className="hover:underline hover:decoration-2 hover:underline-offset-4">
                    {name(title)}
                  </Link>
                </th>
                {[progressA, progressB].map((p, i) => (
                  <td key={i} className="px-1 py-2 text-center">
                    <span
                      aria-label={`${nameOf(i ? right : left)}: ${seen(p, title.id) ? t("status.watched") : t("status.none")}`}
                      className={`inline-block size-4 border-2 border-line align-middle ${seen(p, title.id) ? "bg-accent" : ""}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
