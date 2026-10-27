import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../identity/http/auth.guard';
import { CatalogReader } from '../../catalog/application/catalog-reader';
import { AuctionsService } from '../application/auctions.service';
import { MarketQueries } from '../application/market.queries';
import { ShopService } from '../application/shop.service';
import { TradesService } from '../application/trades.service';
import { AuctionListDto, BidDto, BuyDto, CreateAuctionDto, CreateTradeDto, TradeListDto } from './market.dto';

/** Carte gagnée, telle qu'affichée : vue du catalogue + exemplaires possédés. */
async function wonCard(catalog: CatalogReader, won: { carId: number; quantity: number; isNew: boolean }) {
  const view = await catalog.view(won.carId);
  return view ? { ...view, quantity: won.quantity, isNew: won.isNew } : null;
}

@Controller('shop')
export class ShopController {
  constructor(
    private readonly shop: ShopService,
    private readonly queries: MarketQueries,
    private readonly catalog: CatalogReader,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.queries.shop(user.id);
  }

  @Post('buy')
  @HttpCode(200)
  async buy(@CurrentUser() user: AuthUser, @Body() body: BuyDto) {
    const { balance, ...won } = await this.shop.buy(user.id, body.offerKey);
    return { card: await wonCard(this.catalog, won), balance };
  }
}

@Controller('trades')
export class TradesController {
  constructor(
    private readonly trades: TradesService,
    private readonly queries: MarketQueries,
    private readonly catalog: CatalogReader,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: TradeListDto) {
    return this.queries.trades(user.id, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateTradeDto) {
    return this.trades.create(user.id, body);
  }

  @Post(':id/accept')
  @HttpCode(200)
  async accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const { tradeId, balance, ...won } = await this.trades.accept(user.id, id);
    return { card: await wonCard(this.catalog, won), balance, tradeId };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.trades.cancel(user.id, id);
  }
}

@Controller('auctions')
export class AuctionsController {
  constructor(
    private readonly auctions: AuctionsService,
    private readonly queries: MarketQueries,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: AuctionListDto) {
    return this.queries.auctions(user.id, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateAuctionDto) {
    return this.auctions.create(user.id, body);
  }

  @Post(':id/bid')
  @HttpCode(200)
  bid(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: BidDto) {
    return this.auctions.bid(user.id, id, body.amount);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.auctions.cancel(user.id, id);
  }
}
