import type { FranchiseStateDoc, ProgressData, ProgressDoc } from "./progressStore";

export interface MigrationPlan {
  progress: [titleId: string, doc: ProgressDoc][];
  franchiseState: [franchiseId: string, doc: FranchiseStateDoc][];
}

/**
 * Qué documentos del modo invitado hay que escribir en el perfil de la cuenta.
 * Por documento gana el cambio más reciente (SPEC §6): lo que ya existe en la nube y es
 * más nuevo que lo local no se toca.
 */
export function planMigration(guest: ProgressData, cloud: ProgressData): MigrationPlan {
  const newer = <T extends { updatedAt: string }>(local: T, remote: T | undefined) =>
    !remote || local.updatedAt > remote.updatedAt;

  return {
    progress: Object.entries(guest.progress).filter(([id, doc]) => newer(doc, cloud.progress[id])),
    franchiseState: Object.entries(guest.franchiseState).filter(([id, doc]) => newer(doc, cloud.franchiseState[id])),
  };
}

export const planSize = (plan: MigrationPlan) => plan.progress.length + plan.franchiseState.length;
