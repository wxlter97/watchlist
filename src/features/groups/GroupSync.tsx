import { useEffect, useState } from "react";
import { useCatalog, withReferences } from "../../lib/catalog";
import { groupTitles, mirrorChanges, type GroupProgressDoc } from "../../lib/groups";
import { publishWatched, subscribeGroupProgress, useGroupsStore } from "../../lib/groupsStore";
import { useProgressStore } from "../../lib/progressStore";
import { useSession } from "../../lib/session";

/**
 * Publica en cada grupo lo que el perfil con el que participa vio de la meta del grupo (y
 * quita lo desmarcado). Solo corre con ese perfil activo: el progreso de otros perfiles no
 * está cargado.
 */
export function GroupSync() {
  const uid = useSession((s) => s.user?.uid);
  const activeProfileId = useSession((s) => s.activeProfileId);
  const ready = useSession((s) => s.profileReady);
  const groups = useGroupsStore((s) => s.groups);
  const mine = uid ? groups.filter((g) => g.members[uid] === activeProfileId) : [];
  const key = mine.map((g) => g.id).join(",");

  return (
    <>
      {ready && uid && mine.map((g) => <GroupMirror key={`${g.id}:${key}`} groupId={g.id} uid={uid} />)}
    </>
  );
}

function GroupMirror({ groupId, uid }: { groupId: string; uid: string }) {
  const group = useGroupsStore((s) => s.groups.find((g) => g.id === groupId));
  const progress = useProgressStore((s) => s.progress);
  const [shared, setShared] = useState<Record<string, GroupProgressDoc> | null>(null);
  // Con la meta sin cargar, mirrorChanges quitaría todo lo publicado: se espera al catálogo.
  const catalog = useCatalog(withReferences(group?.franchiseId));

  useEffect(() => subscribeGroupProgress(groupId, setShared), [groupId]);

  useEffect(() => {
    if (!group || !shared || !catalog.ready) return;
    const timer = setTimeout(() => {
      const changes = mirrorChanges(groupTitles(group, catalog.index), progress, shared, uid);
      if (Object.keys(changes.add).length || changes.remove.length) publishWatched(groupId, uid, changes);
    }, 1500);
    return () => clearTimeout(timer);
  }, [group, shared, catalog.ready, catalog.index, progress, groupId, uid]);

  return null;
}
