import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { RARITIES } from '../game/rarity';
import { TradesService } from './trades.service';

class CreateTradeDto {
  @Type(() => Number) @IsInt() @Min(1)
  offeredCarId: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  wantedCarId?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000)
  price?: number;
}

class TradeQueryDto {
  @IsOptional() @IsIn(['all', 'mine', 'forme'])
  tab: 'all' | 'mine' | 'forme' = 'all';

  @IsOptional() @IsIn(RARITIES)
  rarity?: string;

  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
}

@Controller('trades')
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: TradeQueryDto) {
    return this.trades.list(user.id, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateTradeDto) {
    return this.trades.create(user.id, body);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.trades.accept(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.trades.cancel(user.id, id);
  }
}
