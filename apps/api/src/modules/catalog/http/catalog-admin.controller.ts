import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Public } from '../../identity/http/auth.guard';
import { CatalogImportService, ImportSource } from '../application/catalog-import.service';
import { MediaSyncService } from '../application/media-sync.service';
import { AdminTokenGuard } from './admin-token.guard';

class ImportDto {
  @IsOptional() @IsIn(['wikidata', 'seed', 'media'])
  source?: ImportSource | 'media';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20_000)
  limit?: number;
}

/** Administration du catalogue, protégée par l'en-tête `x-admin-token` (pas de session joueur). */
@Public()
@UseGuards(AdminTokenGuard)
@Controller('admin/catalog')
export class CatalogAdminController {
  constructor(
    private readonly catalog: CatalogImportService,
    private readonly media: MediaSyncService,
  ) {}

  /** État du catalogue : nombre de cartes, photos rapatriées / en attente, résumés. */
  @Get('status')
  status() {
    return this.media.stats();
  }

  /** Relance l'import du catalogue (en arrière-plan). */
  @Post('import')
  @HttpCode(202)
  import(@Body() body: ImportDto) {
    if (body.source === 'media') void this.media.syncAll();
    else void this.catalog.import(body.source === 'seed' ? 'seed' : 'wikidata', body.limit);
    return { started: true };
  }
}
