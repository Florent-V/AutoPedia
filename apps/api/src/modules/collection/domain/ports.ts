import { Rarity } from '../../catalog/domain/rarity';

/** Carte tirée au sort dans le catalogue. */
export interface DrawnCar {
  id: number;
  rarity: Rarity;
}

/** Accès au catalogue pour les tirages (adaptateur vers le contexte Catalogue). */
export abstract class CarPool {
  /** Une carte active de la rareté demandée (ou de la plus proche), hors `exclude` si possible. */
  abstract pick(rarity: Rarity, exclude: number[]): Promise<DrawnCar | null>;
}

/** Cartes possédées par les joueurs. */
export abstract class OwnedCards {
  /** Ajoute un exemplaire ; `isNew` si le joueur ne l'avait pas. */
  abstract add(userId: string, carId: number, at: Date): Promise<{ quantity: number; isNew: boolean }>;
  /** Retire un exemplaire ; renvoie false si le joueur ne possède pas la carte. */
  abstract remove(userId: string, carId: number): Promise<boolean>;
  abstract quantity(userId: string, carId: number): Promise<number>;
}
