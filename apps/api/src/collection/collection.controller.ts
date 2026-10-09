import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { CollectionQuery } from './collection.query';
import { CollectionService } from './collection.service';

@Controller('collection')
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: CollectionQuery) {
    return this.collection.list(user.id, query);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.collection.summary(user.id);
  }
}
