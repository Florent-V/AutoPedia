import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RARITIES } from '../../catalog/domain/rarity';

import { CollectionFilter } from '../application/collection.query';

export class CollectionQueryDto implements CollectionFilter {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(RARITIES)
  rarity?: (typeof RARITIES)[number];

  @IsOptional() @IsString() @MaxLength(100)
  manufacturer?: string;

  @IsOptional() @IsIn(['racing', 'road'])
  category?: 'racing' | 'road';

  @IsOptional() @IsIn(['all', 'owned', 'missing'])
  owned: 'all' | 'owned' | 'missing' = 'all';

  @IsOptional() @IsIn(['rarity', 'name', 'year', 'recent'])
  sort: 'rarity' | 'name' | 'year' | 'recent' = 'rarity';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 30;
}
