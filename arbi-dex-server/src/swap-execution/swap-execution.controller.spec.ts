import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SwapExecutionController } from './swap-execution.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Locks the Phase 1 security fix: the fund-spending swap endpoint must be behind
 * JwtAuthGuard so it can never be called unauthenticated.
 */
describe('SwapExecutionController (auth guard)', () => {
  it('is protected by JwtAuthGuard at the controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SwapExecutionController) as unknown[];
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
  });

  it('guards the execute() handler too (inherits the controller guard)', () => {
    const controllerGuards = Reflect.getMetadata(GUARDS_METADATA, SwapExecutionController) as unknown[];
    // Controller-level guard applies to every route including execute().
    expect(controllerGuards.some((g) => g === JwtAuthGuard)).toBe(true);
  });
});
