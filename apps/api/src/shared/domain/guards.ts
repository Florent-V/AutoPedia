import { InvalidRequest } from './errors';

/**
 * Contrôles de bornes répétés dans le domaine : même si un DTO laisse passer une valeur,
 * le domaine refuse tout entier négatif, décimal ou démesuré (défense en profondeur).
 */
export function positiveInt(value: number, what: string, max = 1_000_000_000): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new InvalidRequest(`${what} invalide`);
  return value;
}

export function nonNegativeInt(value: number, what: string, max = 1_000_000_000): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new InvalidRequest(`${what} invalide`);
  return value;
}
