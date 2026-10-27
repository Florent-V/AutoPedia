export interface BoosterState {
  boosters: number;
  anchor: Date;
}

export interface BoosterStatus extends BoosterState {
  max: number;
  regenMs: number;
  /** Date d'obtention du prochain booster, null si la réserve est pleine. */
  nextAt: Date | null;
}

/**
 * Applique la régénération écoulée depuis `anchor`.
 * Tant que la réserve n'est pas pleine, un booster est gagné toutes les `regenMs`.
 * Une fois pleine, le minuteur est figé (l'ancre suit l'heure courante).
 */
export function computeBoosters(state: BoosterState, now: Date, max: number, regenMs: number): BoosterStatus {
  let { boosters, anchor } = state;
  if (boosters >= max) {
    return { boosters, anchor: now, max, regenMs, nextAt: null };
  }
  const elapsed = Math.max(0, now.getTime() - anchor.getTime());
  const gained = Math.floor(elapsed / regenMs);
  if (boosters + gained >= max) {
    return { boosters: max, anchor: now, max, regenMs, nextAt: null };
  }
  boosters += gained;
  anchor = new Date(anchor.getTime() + gained * regenMs);
  return { boosters, anchor, max, regenMs, nextAt: new Date(anchor.getTime() + regenMs) };
}

/** Consomme un booster (la régénération doit déjà avoir été appliquée). */
export function consumeBooster(status: BoosterStatus, now: Date): BoosterStatus {
  if (status.boosters <= 0) throw new Error('No booster available');
  const wasFull = status.boosters >= status.max;
  const anchor = wasFull ? now : status.anchor;
  const boosters = status.boosters - 1;
  return { ...status, boosters, anchor, nextAt: new Date(anchor.getTime() + status.regenMs) };
}
