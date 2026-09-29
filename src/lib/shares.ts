import type { CatalogIndex } from "./catalogIndex";
import { effectiveHidden } from "./filters";
import { computeOrder, CUSTOM_ORDER_ID, resolveOrder } from "./orders";
import type { FranchiseStateDoc, ProgressDoc } from "./progressStore";
import { resolveRoute } from "./routes";
import type { Lang } from "./types";

// Links públicos de solo lectura (SPEC §9.5): una foto del momento en que se comparte, nunca
// el progreso vivo. Re-compartir actualiza la misma foto (mismo link).

export type ShareKind = "route" | "custom-order" | "progress";

export interface ShareSnapshot {
  /** En el orden en que se muestran. */
  titleIds: string[];
  /** Los vistos, de entre titleIds. */
  watched: string[];
}

export interface ShareDoc {
  id: string;
  ownerUid: string;
  profileId: string;
  /** Nombre del perfil que comparte, tal como se muestra en la página pública. */
  ownerName: string;
  kind: ShareKind;
  franchiseId: string;
  /** Ruta (route) o franquicia (custom-order, progress). */
  refId: string;
  title: string;
  lang: Lang;
  snapshot: ShareSnapshot;
  createdAt: string;
  updatedAt: string;
  revoked: boolean;
}

export interface ShareTarget {
  kind: ShareKind;
  franchiseId: string;
  refId: string;
}

/** Títulos y vistos de lo que se comparte. undefined si ya no existe en el catálogo. */
export function buildSnapshot(
  target: ShareTarget,
  ctx: { index: CatalogIndex; progress: Readonly<Record<string, ProgressDoc>>; franchiseState: Readonly<Record<string, FranchiseStateDoc>> },
): ShareSnapshot | undefined {
  const franchise = ctx.index.franchisesById.get(target.franchiseId);
  if (!franchise) return undefined;
  const state = ctx.franchiseState[franchise.id];
  const hiddenContinuities = effectiveHidden(franchise, state?.hiddenContinuities, state?.shownContinuities);

  let titleIds: string[];
  if (target.kind === "route") {
    const route = franchise.routes.find((r) => r.id === target.refId);
    if (!route) return undefined;
    titleIds = resolveRoute(route, franchise, ctx.index).map((i) => i.title.id);
  } else if (target.kind === "custom-order") {
    if (!state?.customOrder?.length) return undefined;
    const order = resolveOrder(franchise, CUSTOM_ORDER_ID, state.customOrder);
    titleIds = computeOrder(franchise, order, ctx.index.titlesById, { hiddenContinuities }).map((i) => i.title.id);
  } else {
    // Progreso: en orden de estreno, lo ya estrenado de las continuidades visibles.
    const order = resolveOrder(franchise, "release");
    const today = new Date().toISOString().slice(0, 10);
    titleIds = computeOrder(franchise, order, ctx.index.titlesById, { hiddenContinuities })
      .filter((i) => i.title.releaseDate <= today)
      .map((i) => i.title.id);
  }
  return { titleIds, watched: titleIds.filter((id) => ctx.progress[id]?.status === "watched") };
}

/** El link ya existente para lo mismo (mismo perfil, tipo y referencia), para reusarlo. */
export function findShare(shares: readonly ShareDoc[], profileId: string, target: ShareTarget): ShareDoc | undefined {
  return shares.find(
    (s) => s.profileId === profileId && s.kind === target.kind && s.franchiseId === target.franchiseId && s.refId === target.refId,
  );
}

export function publicShareUrl(origin: string, id: string, lang: Lang): string {
  return `${origin}/${lang}/s/${id}`;
}

/** Id público: 12 caracteres aleatorios, imposibles de adivinar en la práctica. */
export function newShareId(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => alphabet[b % alphabet.length]).join("");
}
