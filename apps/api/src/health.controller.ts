import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.guard';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    const cards = await this.prisma.car.count({ where: { active: true } });
    return { status: 'ok', cards };
  }
}
