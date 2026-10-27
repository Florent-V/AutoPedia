import { Module } from '@nestjs/common';
import { PlayerStatsQuery } from './player-stats.query';

/** Modèle de lecture : statistiques d'un joueur (collection, crédits, compteurs), utilisées par l'affichage et les succès. */
@Module({ providers: [PlayerStatsQuery], exports: [PlayerStatsQuery] })
export class StatisticsModule {}
