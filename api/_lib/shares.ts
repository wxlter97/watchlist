import type { ShareDoc } from "../../src/lib/shares";
import { adminDb } from "./admin";
import { HttpError } from "./tmdb";

export type PublicShare = Omit<ShareDoc, "createdAt" | "updatedAt"> & { updatedAtMs: number };

/** Un link activo. Revocado o inexistente: el mismo 404, sin distinguir. */
export async function loadShare(id: string): Promise<PublicShare> {
  if (!/^[A-Za-z0-9]{6,32}$/.test(id)) throw new HttpError(404, "No existe");
  const snap = await adminDb().doc(`shares/${id}`).get();
  const d = snap.data();
  if (!d || d.revoked !== false) throw new HttpError(404, "No existe");
  const updated = d.updatedAt as { toMillis?: () => number } | undefined;
  return {
    ...(d as Omit<PublicShare, "id" | "updatedAtMs">),
    id,
    snapshot: { titleIds: d.snapshot?.titleIds ?? [], watched: d.snapshot?.watched ?? [] },
    updatedAtMs: updated?.toMillis?.() ?? 0,
  };
}
