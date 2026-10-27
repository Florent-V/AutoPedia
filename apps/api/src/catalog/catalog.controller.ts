import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/auth.guard';
import { CatalogService, ImportSource } from './catalog.service';
import { MediaService } from './media.service';

function checkToken(token: string | undefined) {
  const expected = process.env.ADMIN_TOKEN ?? '';
  const valid =
    expected.length >= 16 &&
    !!token &&
    token.length === expected.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!valid) throw new ForbiddenException();
}

class ImportDto {
  @IsOptional() @IsIn(['wikidata', 'seed', 'media'])
  source?: ImportSource | 'media';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20_000)
  limit?: number;
}

@Controller('admin/catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly media: MediaService,
  ) {}

  /** État du catalogue : nombre de cartes, photos rapatriées / en attente, résumés. */
  @Public()
  @Get('status')
  status(@Headers('x-admin-token') token: string | undefined) {
    checkToken(token);
    return this.media.stats();
  }

  /** Relance l'import du catalogue. Protégé par l'en-tête `x-admin-token` (variable ADMIN_TOKEN). */
  @Public()
  @Post('import')
  @HttpCode(202)
  import(
    @Headers('x-admin-token') token: string | undefined,
    @Body() body: ImportDto,
  ) {
    checkToken(token);
    if (body?.source === 'media') void this.media.syncAll();
    else void this.catalog.import(body?.source === 'seed' ? 'seed' : 'wikidata', body?.limit);
    return { started: true };
  }
}
