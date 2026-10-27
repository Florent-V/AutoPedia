import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { PlayerModule } from '../player/player.module';
import { ProgressionModule } from '../progression/progression.module';
import { WalletModule } from '../wallet/wallet.module';
import { BotsService } from './application/bots.service';

/**
 * Contexte « Bots » : joueurs automatiques (signalés 🤖) qui animent le marché.
 * Ils passent par les mêmes cas d'usage que les joueurs : mêmes règles, mêmes contrôles.
 */
@Module({
  imports: [PlayerModule, CollectionModule, ProgressionModule, MarketplaceModule, WalletModule],
  providers: [BotsService],
})
export class BotsModule {}
