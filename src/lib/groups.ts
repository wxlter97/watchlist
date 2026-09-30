import type { CatalogIndex } from "./catalogIndex";
import { effectiveHidden } from "./filters";
import { computeOrder, resolveOrder } from "./orders";
import { resolveRoute } from "./routes";
import type { Title } from "./types";

// Grupos para ver en pareja o en grupo (SPEC §9.5). Cada miembro publica en el grupo solo lo
// que vio de la meta del grupo; su progreso personal sigue siendo privado.

export interface GroupDoc {
  id: string;
  name: string;
  ownerUid: string;
  /** uid → perfil con el que participa. */
  members: Record<string, string>;
  /** Las mismas claves que members, para consultar "mis grupos". */
  memberUids: string[];
  memberNames: Record<string, string>;
  franchiseId: string;
  routeId?: string;
  inviteCode: string;
  createdAt: string;
}

export interface GroupProgressDoc {
  /** uid → cuándo lo vio (ISO). */
  watchedBy: Record<string, string>;
  watchedTogether: boolean;
  updatedAt: string;
}

export const MAX_MEMBERS = 12;

/** Títulos de la meta: la ruta, o la franquicia por estreno (continuidades visibles por defecto). */
export function groupTitles(group: Pick<GroupDoc, "franchiseId" | "routeId">, index: CatalogIndex): Title[] {
  const franchise = index.franchisesById.get(group.franchiseId);
  if (!franchise) return [];
  if (group.routeId) {
    const route = franchise.routes.find((r) => r.id === group.routeId);
    return uniqueTitles(route ? resolveRoute(route, franchise, index).map((i) => i.title) : []);
  }
  const order = resolveOrder(franchise, "release");
  return uniqueTitles(
    computeOrder(franchise, order, index.titlesById, { hiddenContinuities: effectiveHidden(franchise, undefined, undefined) }).map((i) => i.title),
  );
}

/** El grupo marca series enteras: una serie repartida por temporadas aparece una vez. */
const uniqueTitles = (titles: Title[]) => [...new Map(titles.map((t) => [t.id, t])).values()];

/** Siguiente para ver juntos: el primer estreno de la meta que no vieron juntos ni vieron todos. */
export function nextTogether(
  titles: readonly Title[],
  progress: Readonly<Record<string, GroupProgressDoc>>,
  memberUids: readonly string[],
  today: string,
): Title | undefined {
  return titles.find((t) => {
    if (t.releaseDate > today) return false;
    const doc = progress[t.id];
    if (doc?.watchedTogether) return false;
    return !memberUids.every((uid) => doc?.watchedBy[uid]);
  });
}

/** Cuántos títulos de la meta vio cada miembro. */
export function memberCounts(
  titles: readonly Title[],
  progress: Readonly<Record<string, GroupProgressDoc>>,
  memberUids: readonly string[],
): Record<string, number> {
  return Object.fromEntries(memberUids.map((uid) => [uid, titles.filter((t) => progress[t.id]?.watchedBy[uid]).length]));
}

/**
 * Qué publicar en el grupo para que refleje lo que este miembro vio: agregar (con su fecha)
 * lo visto que falta y quitar lo que ya no está visto.
 */
export function mirrorChanges(
  titles: readonly Title[],
  mine: Readonly<Record<string, { status: string; watchedAt?: string; updatedAt: string }>>,
  progress: Readonly<Record<string, GroupProgressDoc>>,
  uid: string,
): { add: Record<string, string>; remove: string[] } {
  const add: Record<string, string> = {};
  const remove: string[] = [];
  for (const t of titles) {
    const doc = mine[t.id];
    const watched = doc?.status === "watched";
    const published = Boolean(progress[t.id]?.watchedBy[uid]);
    if (watched && !published) add[t.id] = doc.watchedAt ?? doc.updatedAt;
    if (!watched && published) remove.push(t.id);
  }
  return { add, remove };
}

/** Código de invitación: 8 caracteres sin ambiguos (0/O, 1/I/l). */
export function newInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => alphabet[b % alphabet.length]).join("");
}

export const inviteUrl = (origin: string, groupId: string, code: string) => `${origin}/join/${groupId}?code=${code}`;
