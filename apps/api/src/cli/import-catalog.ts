import '../env';
import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { CatalogModule } from '../modules/catalog/catalog.module';
import { CatalogImportService } from '../modules/catalog/application/catalog-import.service';
import { MediaSyncService } from '../modules/catalog/application/media-sync.service';

@Module({ imports: [SharedModule, CatalogModule] })
class CliModule {}

/**
 * Usage : node dist/cli/import-catalog [mode] [limite]
 *   wikidata (défaut) : import du catalogue + photos + résumés
 *   seed              : jeu de secours + photos + résumés
 *   media             : reprend seulement le rapatriement des photos et résumés
 *   stats             : affiche l'état du catalogue
 */
async function main() {
  process.env.CATALOG_AUTO_IMPORT = 'off';
  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['log', 'warn', 'error'] });
  const mode = process.argv[2] ?? 'wikidata';
  const catalog = app.get(CatalogImportService);
  const media = app.get(MediaSyncService);
  if (mode === 'media') await media.syncAll();
  else if (mode === 'seed' || mode === 'wikidata') {
    const limit = Number(process.argv[3] ?? process.env.CATALOG_IMPORT_LIMIT ?? 3000);
    Logger.log(`Résultat : ${JSON.stringify(await catalog.import(mode, limit))}`, 'Import');
  } else if (mode !== 'stats') throw new Error(`Mode inconnu : ${mode}`);
  Logger.log(`État : ${JSON.stringify(await media.stats())}`, 'Import');
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
