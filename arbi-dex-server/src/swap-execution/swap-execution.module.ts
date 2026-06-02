import { Module } from '@nestjs/common';
import { SwapExecutionController } from './swap-execution.controller';
import { SwapExecutionService } from './swap-execution.service';

@Module({
  controllers: [SwapExecutionController],
  providers: [SwapExecutionService],
})
export class SwapExecutionModule {}

