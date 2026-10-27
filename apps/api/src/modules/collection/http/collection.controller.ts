import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../identity/http/auth.guard';
import { CollectionQueryService } from '../application/collection.query';
import { CollectionQueryDto } from './collection-query.dto';

@Controller('collection')
export class CollectionController {
  constructor(private readonly collection: CollectionQueryService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: CollectionQueryDto) {
    return this.collection.list(user.id, query);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.collection.summary(user.id);
  }
}
