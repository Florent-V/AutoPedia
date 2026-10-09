import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/auth.guard';
import { CatalogService, ImportSource } from './catalog.service';

@Controller('admin/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Relance l'import du catalogue. Protégé par l'en-tête `x-admin-token` (variable ADMIN_TOKEN). */
  @Public()
  @Post('import')
  @HttpCode(202)
  import(@Headers('x-admin-token') token: string | undefined, @Body() body: { source?: ImportSource; limit?: number }) {
    const expected = process.env.ADMIN_TOKEN ?? '';
    const valid =
      expected.length >= 16 &&
      !!token &&
      token.length === expected.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    if (!valid) throw new ForbiddenException();
    void this.catalog.import(body?.source === 'seed' ? 'seed' : 'wikidata', body?.limit);
    return { started: true };
  }
}
