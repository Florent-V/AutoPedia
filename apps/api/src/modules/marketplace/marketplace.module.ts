import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CollectionModule } from '../collection/collection.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuctionsService } from './application/auctions.service';
import { MarketJobs } from './application/market-jobs';
import { MarketQueries } from './application/market.queries';
import { ShopService } from './application/shop.service';
import { TradesService } from './application/trades.service';
import { AuctionRepository, MarketCounters, ShopCatalog, ShopPurchaseRepository, TraderProfiles, TradeOfferRepository } from './domain/ports';
import { AuctionsController, ShopController, TradesController } from './http/market.controllers';
import {
  CatalogShopCatalog,
  PrismaAuctionRepository,
  PrismaMarketCounters,
  PrismaShopPurchaseRepository,
  PrismaTraderProfiles,
  PrismaTradeOfferRepository,
} from './infrastructure/prisma-marketplace.repositories';

/** Contexte « Marché » : boutique horaire, bourse d'échanges, enchères. */
@Module({
  imports: [WalletModule, CollectionModule, CatalogModule],
  controllers: [ShopController, TradesController, AuctionsController],
  providers: [
    ShopService,
    TradesService,
    AuctionsService,
    MarketQueries,
    MarketJobs,
    { provide: TradeOfferRepository, useClass: PrismaTradeOfferRepository },
    { provide: AuctionRepository, useClass: PrismaAuctionRepository },
    { provide: ShopPurchaseRepository, useClass: PrismaShopPurchaseRepository },
    { provide: ShopCatalog, useClass: CatalogShopCatalog },
    { provide: MarketCounters, useClass: PrismaMarketCounters },
    { provide: TraderProfiles, useClass: PrismaTraderProfiles },
  ],
  exports: [TradesService, AuctionsService, MarketQueries],
})
export class MarketplaceModule {}
