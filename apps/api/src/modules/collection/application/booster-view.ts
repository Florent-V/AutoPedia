import { BoosterStatus } from '../domain/booster-clock';

/** Réserve telle qu'affichée par le client (le compte à rebours est calculé avec l'heure du serveur). */
export function boosterView(status: BoosterStatus, now: Date) {
  return {
    available: status.boosters,
    max: status.max,
    regenMs: status.regenMs,
    nextAt: status.nextAt?.toISOString() ?? null,
    serverTime: now.toISOString(),
  };
}

export type BoosterView = ReturnType<typeof boosterView>;
