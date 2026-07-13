import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CONDITIONS_CATALOG } from '../demo/engine/conditions-catalog';

@ApiTags('ConditionsCatalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conditions-catalog')
export class ConditionsCatalogController {
  @Get()
  @ApiOperation({
    summary: 'Каталог условий автоторговли',
    description: 'Метаданные условий (gate/trigger) с параметрами, диапазонами редактирования и авто-подбора.',
  })
  @ApiResponse({ status: 200, description: 'Массив условий' })
  getCatalog() {
    return CONDITIONS_CATALOG;
  }
}
