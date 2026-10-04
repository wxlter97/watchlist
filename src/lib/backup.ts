import { type FranchiseStateDoc, type ProgressData, type ProgressDoc, type WatchStatus } from "./progressStore";
import type { UnlockDoc } from "./achievementsStore";
import type { PlanDoc } from "./plans";
import { isPrepLevel } from "./prep";
import type { Settings } from "./settings";
import { cleanViewings } from "./viewings";

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

export interface FullExport extends Omit<Backup, "app"> {
  /** Distingue este archivo (para llevarte tus datos) del respaldo que se puede importar. */
  app: "watch-order-export";
  account: { name: string; email: string | null } | null;
  settings: Settings;
  plans: Omit<PlanDoc, "feedToken">[];
  achievements: Record<string, UnlockDoc>;
}

/**
 * Todo lo que la app guarda de una persona, en JSON legible (portabilidad de datos): el progreso
 * del perfil y además planes, logros, ajustes y los datos de la cuenta. El secreto del feed de
 * calendario se deja fuera: dar el archivo no debe dar acceso al feed.
 */
export function buildFullExport(
  profile: string,
  data: ProgressData & { plans: Record<string, PlanDoc>; achievements: Record<string, UnlockDoc>; settings: Settings; account: FullExport["account"] },
  now = new Date(),
): FullExport {
  return {
    ...buildBackup(profile, data, now),
    app: "watch-order-export",
    account: data.account,
    settings: data.settings,
    plans: Object.values(data.plans).map(({ feedToken: _feedToken, ...plan }) => plan),
    achievements: data.achievements,
  };
}

export function fullExportFileName(profile: string, now = new Date()): string {
  return backupFileName(profile, now).replace("watch-order-", "watch-order-todos-mis-datos-");
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
      (d.startedAt === undefined || isIso(d.startedAt)) &&
      (d.rating === undefined || (Number.isInteger(d.rating) && d.rating >= 1 && d.rating <= 5)) &&
      (d.notes === undefined || typeof d.notes === "string");
    if (!valid) {
      skipped++;
      continue;
    }
    const viewings = cleanViewings(d);
    progress[id] = {
      status: d.status!,
      rewatchCount: Number.isInteger(d.rewatchCount) && d.rewatchCount! >= 0 ? d.rewatchCount! : 0,
      updatedAt: d.updatedAt!,
      ...(d.watchedAt ? { watchedAt: d.watchedAt } : {}),
      ...(d.startedAt ? { startedAt: d.startedAt } : {}),
      ...(d.rating ? { rating: d.rating } : {}),
      ...(d.notes ? { notes: d.notes.slice(0, 2000) } : {}),
      ...(typeof d.versionId === "string" ? { versionId: d.versionId } : {}),
      ...(viewings.length ? { viewings } : {}),
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
    const prepLevels = Object.fromEntries(
      Object.entries(d.prepLevels && typeof d.prepLevels === "object" ? d.prepLevels : {}).filter(([k, v]) => /^[a-z0-9-]+$/.test(k) && isPrepLevel(v)),
    );
    franchiseState[id] = {
      updatedAt: d.updatedAt!,
      ...(typeof d.lastOrderId === "string" ? { lastOrderId: d.lastOrderId } : {}),
      ...(isStrings(d.customOrder) ? { customOrder: d.customOrder } : {}),
      ...(typeof d.activeRoute === "string" && d.activeRoute.startsWith("/f/") ? { activeRoute: d.activeRoute } : {}),
      ...(Object.keys(prepLevels).length ? { prepLevels } : {}),
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
