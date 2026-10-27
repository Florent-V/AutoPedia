import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AchievementDef } from '../domain/achievements';

export type UnlockedAchievement = AchievementDef & { reward: number };

const BAG = Symbol('unlocked-achievements');

/**
 * Succès débloqués pendant la requête en cours (par n'importe quel contexte, via les événements).
 * L'intercepteur HTTP les ajoute à la réponse du joueur concerné.
 */
@Injectable()
export class AchievementUnlocks {
  constructor(private readonly cls: ClsService) {}

  /** Ouvre le recueil pour la requête (appelé par l'intercepteur, avant toute transaction). */
  open() {
    if (this.cls.isActive()) this.cls.set(BAG, []);
  }

  record(userId: string, list: UnlockedAchievement[]) {
    const bag = this.cls.isActive() ? this.cls.get<Array<{ userId: string; a: UnlockedAchievement }> | undefined>(BAG) : undefined;
    bag?.push(...list.map((a) => ({ userId, a })));
  }

  forUser(userId: string): UnlockedAchievement[] {
    const bag = this.cls.isActive() ? this.cls.get<Array<{ userId: string; a: UnlockedAchievement }> | undefined>(BAG) : undefined;
    return (bag ?? []).filter((e) => e.userId === userId).map((e) => e.a);
  }
}
