import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CarDetailService } from '../../catalog/application/car-detail.service';
import { AuthUser, CurrentUser } from '../../identity/http/auth.guard';
import { CardsService } from '../application/cards.service';

/** Fiche d'une carte vue par le joueur : données du catalogue + exemplaires possédés. */
@Controller('cars')
export class CarsController {
  constructor(
    private readonly cars: CarDetailService,
    private readonly cards: CardsService,
  ) {}

  @Get(':id')
  async detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const [car, owned] = await Promise.all([this.cars.detail(id), this.cards.ownership(user.id, id)]);
    return { ...car, ...owned };
  }
}
