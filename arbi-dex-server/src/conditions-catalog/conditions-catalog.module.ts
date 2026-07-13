import { Module } from '@nestjs/common';
import { ConditionsCatalogController } from './conditions-catalog.controller';

@Module({
  controllers: [ConditionsCatalogController],
})
export class ConditionsCatalogModule {}
