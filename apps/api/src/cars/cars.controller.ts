import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { CarsService } from './cars.service';

@Controller('cars')
export class CarsController {
  constructor(private readonly cars: CarsService) {}

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.cars.detail(user.id, id);
  }
}
