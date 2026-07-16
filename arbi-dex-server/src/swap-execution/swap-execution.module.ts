import { Module } from '@nestjs/common';
import { SwapExecutionController } from './swap-execution.controller';
import { SwapExecutionService } from './swap-execution.service';
import { SwapQuoterService } from './swap-quoter.service';

@Module({
  controllers: [SwapExecutionController],
  providers: [SwapExecutionService, SwapQuoterService],
  exports: [SwapExecutionService, SwapQuoterService],
})
export class SwapExecutionModule {}

