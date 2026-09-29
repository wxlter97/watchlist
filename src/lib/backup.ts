import type { FranchiseStateDoc, ProgressData, ProgressDoc, WatchStatus } from "./progressStore";

// Exportar / importar el progreso de un perfil en JSON (SPEC §9).

export const BACKUP_VERSION = 1;
const STATUSES: WatchStatus[] = ["watched", "watching", "dropped", "planned"];

export interface Backup extends ProgressData {
  app: "watch-order";
  version: number;
  exportedAt: string;
  profile: string;
}

export function buildBackup(profile: string, data: ProgressData, now = new Date()): Backup {
  return {
    app: "watch-order",
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    profile,
    progress: data.progress,
    franchiseState: data.franchiseState,
  };
}

const isIso = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));
const isStrings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

export type ParseResult = { ok: true; data: ProgressData; profile: string; skipped: number } | { ok: false; error: string };

/**
 * Valida un respaldo. Los documentos inválidos se descartan (y se cuentan) en vez de
 * rechazar el archivo completo; lo que no es un respaldo de Watch Order se rechaza.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  const b = raw as Partial<Backup>;
  if (!b || typeof b !== "object" || b.app !== "watch-order") return { ok: false, error: "notBackup" };
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) return { ok: false, error: "newerVersion" };

  let skipped = 0;
  const progress: Record<string, ProgressDoc> = {};
  for (const [id, doc] of Object.entries(b.progress ?? {})) {
    const d = doc as Partial<ProgressDoc>;
    const valid =
      /^[a-z0-9-]+$/.test(id) &&
      STATUSES.includes(d.status as WatchStatus) &&
      isIso(d.updatedAt) &&
      (d.watchedAt === undefined || isIso(d.watchedAt)) &&
      (d.rating === undefined || (Number.isInteger(d.rating) && d.rating >= 1 && d.rating <= 5)) &&
      (d.notes === undefined || typeof d.notes === "string");
    if (!valid) {
      skipped++;
      continue;
    }
    progress[id] = {
      status: d.status!,
      rewatchCount: Number.isInteger(d.rewatchCount) && d.rewatchCount! >= 0 ? d.rewatchCount! : 0,
      updatedAt: d.updatedAt!,
      ...(d.watchedAt ? { watchedAt: d.watchedAt } : {}),
      ...(d.rating ? { rating: d.rating } : {}),
      ...(d.notes ? { notes: d.notes.slice(0, 2000) } : {}),
      ...(typeof d.versionId === "string" ? { versionId: d.versionId } : {}),
      ...(d.episodes && typeof d.episodes === "object"
        ? {
            episodes: Object.fromEntries(
              Object.entries(d.episodes).filter(([, eps]) => Array.isArray(eps) && eps.every((e) => Number.isInteger(e) && e > 0)),
            ),
          }
        : {}),
    };
  }

  const franchiseState: Record<string, FranchiseStateDoc> = {};
  for (const [id, doc] of Object.entries(b.franchiseState ?? {})) {
    const d = doc as Partial<FranchiseStateDoc>;
    if (!/^[a-z0-9-]+$/.test(id) || !isIso(d.updatedAt)) {
      skipped++;
      continue;
    }
    franchiseState[id] = {
      updatedAt: d.updatedAt!,
      ...(typeof d.lastOrderId === "string" ? { lastOrderId: d.lastOrderId } : {}),
      ...(isStrings(d.customOrder) ? { customOrder: d.customOrder } : {}),
      ...(isStrings(d.hiddenContinuities) ? { hiddenContinuities: d.hiddenContinuities } : {}),
      ...(isStrings(d.shownContinuities) ? { shownContinuities: d.shownContinuities } : {}),
    };
  }

  return { ok: true, data: { progress, franchiseState }, profile: typeof b.profile === "string" ? b.profile : "", skipped };
}

export function backupFileName(profile: string, now = new Date()): string {
  const slug = profile.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "perfil";
  return `watch-order-${slug}-${now.toISOString().slice(0, 10)}.json`;
}
