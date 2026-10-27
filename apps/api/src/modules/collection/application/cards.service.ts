import { Injectable } from '@nestjs/common';
import { Clock } from '../../../shared/application/ports';
import { InvalidRequest, Unavailable } from '../../../shared/domain/errors';
import { Rarity } from '../../catalog/domain/rarity';
import { CarPool, DrawnCar, OwnedCards } from '../domain/ports';

/**
 * Point d'entrée des autres contextes pour les cartes des joueurs (gains, séquestre, tirages).
 * À appeler dans une unité de travail, joueur verrouillé.
 */
@Injectable()
export class CardsService {
  constructor(
    private readonly owned: OwnedCards,
    private readonly pool: CarPool,
    private readonly clock: Clock,
  ) {}

  /** Donne un exemplaire d'une carte. */
  grant(userId: string, carId: number) {
    return this.owned.add(userId, carId, this.clock.now());
  }

  /** Retire un exemplaire (mise en séquestre, échange) ; 400 si le joueur ne la possède pas. */
  async take(userId: string, carId: number) {
    if (!(await this.owned.remove(userId, carId))) throw new InvalidRequest('Vous ne possédez pas cette carte');
  }

  quantity(userId: string, carId: number) {
    return this.owned.quantity(userId, carId);
  }

  /** Tire une carte au hasard de la rareté demandée (ou de la plus proche), hors `exclude` si possible. */
  async draw(rarity: Rarity, exclude: number[] = []): Promise<DrawnCar> {
    const car = await this.pool.pick(rarity, exclude);
    if (!car) throw new Unavailable("Le catalogue de cartes est vide : lancez l'import (voir README) puis réessayez.");
    return car;
  }
}
