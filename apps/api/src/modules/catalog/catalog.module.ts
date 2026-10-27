import { Module } from '@nestjs/common';
import { CatalogReader } from './application/catalog-reader';

/** Contexte « Catalogue » : les cartes (voitures), leurs raretés, l'import et les photos. */
@Module({
  providers: [CatalogReader],
  exports: [CatalogReader],
})
export class CatalogModule {}
