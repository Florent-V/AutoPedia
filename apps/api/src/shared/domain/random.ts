/** Générateur de nombres dans [0, 1[ (injectable : cryptographique en production, déterministe en test). */
export type Random = () => number;

/** Mélange de Fisher-Yates (copie). */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickOne<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)];
}
