import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { RARITIES } from '../game/rarity';
import { AuctionsService } from './auctions.service';

class CreateAuctionDto {
  @Type(() => Number) @IsInt() @Min(1)
  carId: number;

  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000)
  startPrice: number;

  @Type(() => Number) @IsInt()
  durationHours: number;
}

class BidDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000)
  amount: number;
}

class AuctionQueryDto {
  @IsOptional() @IsIn(['all', 'selling', 'bidding'])
  tab: 'all' | 'selling' | 'bidding' = 'all';

  @IsOptional() @IsIn(RARITIES)
  rarity?: string;

  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000)
  page = 1;
}

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: AuctionQueryDto) {
    return this.auctions.list(user.id, q);
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
