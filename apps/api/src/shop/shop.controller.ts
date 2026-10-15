import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { ShopService } from './shop.service';

class BuyDto {
  @IsString() @MaxLength(80) offerKey: string;
}

@Controller('shop')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.shop.list(user.id);
  }

  @Post('buy')
  @HttpCode(200)
  buy(@CurrentUser() user: AuthUser, @Body() body: BuyDto) {
    return this.shop.buy(user.id, body.offerKey);
  }
}
