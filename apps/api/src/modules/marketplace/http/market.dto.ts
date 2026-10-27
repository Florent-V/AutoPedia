import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RARITIES } from '../../catalog/domain/rarity';

export class BuyDto {
  @IsString() @MaxLength(80) offerKey: string;
}

export class CreateTradeDto {
  @Type(() => Number) @IsInt() @Min(1)
  offeredCarId: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  wantedCarId?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000)
  price?: number;
}

export class CreateAuctionDto {
  @Type(() => Number) @IsInt() @Min(1)
  carId: number;

  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000)
  startPrice: number;

  @Type(() => Number) @IsInt()
  durationHours: number;
}

export class BidDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000)
  amount: number;
}

class MarketListDto {
  @IsOptional() @IsIn(RARITIES)
  rarity?: string;

  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000)
  page = 1;
}

export class TradeListDto extends MarketListDto {
  @IsOptional() @IsIn(['all', 'mine', 'forme'])
  tab: 'all' | 'mine' | 'forme' = 'all';
}

export class AuctionListDto extends MarketListDto {
  @IsOptional() @IsIn(['all', 'selling', 'bidding'])
  tab: 'all' | 'selling' | 'bidding' = 'all';
}
