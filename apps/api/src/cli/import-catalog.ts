import './env';
import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogService } from '../catalog/catalog.service';

@Module({ imports: [PrismaModule], providers: [CatalogService] })
class CliModule {}

/** Usage : node dist/cli/import-catalog [wikidata|seed] [limite] */
async function main() {
  process.env.CATALOG_AUTO_IMPORT = 'off';
  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['log', 'warn', 'error'] });
  const source = process.argv[2] === 'seed' ? 'seed' : 'wikidata';
  const limit = Number(process.argv[3] ?? process.env.CATALOG_IMPORT_LIMIT ?? 3000);
  const result = await app.get(CatalogService).import(source, limit);
  Logger.log(`Résultat : ${JSON.stringify(result)}`, 'Import');
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
