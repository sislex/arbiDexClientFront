import { isTransactionInProgress } from '../helpers';
import type { MarketStep, StrategyEngineConfig } from '../../types';

/**
 * Condition: no transaction is currently blocking a new trade.
 * Looks across the whole `steps` window for an open transaction.
 */
export function buyNoTransactionInProgress(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return !strategy.buy.requireNoTransactionInProgress || !isTransactionInProgress(steps);
}

export function sellNoTransactionInProgress(steps: MarketStep[], strategy: StrategyEngineConfig): boolean {
  return !strategy.sell.requireNoTransactionInProgress || !isTransactionInProgress(steps);
}
