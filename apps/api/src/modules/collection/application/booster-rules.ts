import { economyConfig, gameConfig } from '../../../config';
import { BoosterRules } from '../domain/booster-reserve';

export const boosterRules: BoosterRules = {
  max: gameConfig.boosterMax,
  regenMs: gameConfig.boosterRegenMs,
  cardsPerBooster: gameConfig.cardsPerBooster,
  pityEpic: economyConfig.pityEpic,
  pityLegendary: economyConfig.pityLegendary,
};
