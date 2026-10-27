import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.guard';
import { PrismaService } from './shared/infrastructure/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    const [cards, images] = await Promise.all([
      this.prisma.car.count({ where: { active: true } }),
      this.prisma.car.count({ where: { active: true, imagePath: { not: null } } }),
    ]);
    return { status: 'ok', cards, images };
  }
}
