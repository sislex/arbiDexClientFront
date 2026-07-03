import { lastStep } from '../helpers';
import type { MarketStep, StrategyEngineConfig } from '../../types';

type BalanceKey = 'token1' | 'token2';

/**
 * The token balance on the current step meets the required minimum. Passes when
 * a balance is not required; a missing balance is treated as -Infinity.
 */
function balanceMet(
  steps: MarketStep[],
  requireBalance: boolean,
  balanceKey: BalanceKey,
  minBalance: number,
): boolean {
  const balance = lastStep(steps).balances?.[balanceKey];
  return !requireBalance || (balance ?? Number.NEGATIVE_INFINITY) >= minBalance;
}

/** Condition (buy): token1 balance is sufficient. */
export function buyToken1BalanceOk(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return balanceMet(steps, strategy.buy.requireToken1Balance, 'token1', strategy.buy.minToken1Balance);
}

/** Condition (sell): token2 balance is sufficient. */
export function sellToken2BalanceOk(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return balanceMet(steps, strategy.sell.requireToken2Balance, 'token2', strategy.sell.minToken2Balance);
}
