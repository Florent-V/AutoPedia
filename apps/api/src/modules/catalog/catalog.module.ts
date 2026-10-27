import { Module } from '@nestjs/common';
import { CarDetailService } from './application/car-detail.service';
import { CatalogImportService } from './application/catalog-import.service';
import { CatalogReader } from './application/catalog-reader';
import { MediaSyncService } from './application/media-sync.service';
import { AdminTokenGuard } from './http/admin-token.guard';
import { CatalogAdminController } from './http/catalog-admin.controller';
import { HealthController } from './http/health.controller';

/**
 * Contexte « Catalogue » : les cartes (voitures), leurs raretés, l'import depuis Wikidata,
 * le rapatriement des photos (Commons) et des résumés (Wikipédia).
 */
@Module({
  controllers: [CatalogAdminController, HealthController],
  providers: [CatalogReader, CarDetailService, CatalogImportService, MediaSyncService, AdminTokenGuard],
  exports: [CatalogReader, CarDetailService, CatalogImportService, MediaSyncService],
})
export class CatalogModule {}
