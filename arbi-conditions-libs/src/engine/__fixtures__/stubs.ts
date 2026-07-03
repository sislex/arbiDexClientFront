/**
 * Reusable stub data for engine tests.
 *
 * The engine now works on a WINDOW of steps (the last element is the current
 * step), so fixtures are step arrays plus strategy configs. Kept
 * framework-agnostic (plain data + a small factory) so the same fixtures can
 * back future wrapper tests too.
 */

import type { MarketStep, StrategyEngineConfig, TransactionEvent } from '../types';

/** Compact factory for a market step. */
export function step(
  time: number,
  buyQuote: number,
  sellQuote: number,
  avgObservedQuote: number,
  extra?: Pick<MarketStep, 'events' | 'balances'>,
): MarketStep {
  return { time, quotes: { buyQuote, sellQuote, avgObservedQuote }, ...extra };
}

/** Loose strategy: conditions are trivially satisfiable (single-step lookback). */
export const TEST_STRATEGY: StrategyEngineConfig = {
  buy: {
    enabled: true,
    requireNoTransactionInProgress: true,
    avgObservedHigherThanBuyPercent: 0,
    avgObservedHigherThanBuyForLastSteps: { steps: 1, percent: 0 },
    maxBuySellSpreadPercent: 100,
    minDelayAfterLastFinishedTransactionMs: 0,
    requireToken1Balance: false,
    minToken1Balance: 0,
  },
  sell: {
    enabled: true,
    requireNoTransactionInProgress: true,
    avgObservedHigherThanSellPercent: 0,
    avgObservedHigherThanSellForLastSteps: { steps: 1, percent: 0 },
    maxBuySellSpreadPercent: 100,
    minDelayAfterLastFinishedTransactionMs: 0,
    requireToken2Balance: false,
    minToken2Balance: 0,
  },
};

/** Both sides disabled — nothing can ever pass. */
export const TEST_STRATEGY_DISABLED: StrategyEngineConfig = {
  buy: { ...TEST_STRATEGY.buy, enabled: false },
  sell: { ...TEST_STRATEGY.sell, enabled: false },
};

/** Requires token balances (for balance-gate tests). */
export const TEST_STRATEGY_REQUIRE_BALANCE: StrategyEngineConfig = {
  buy: { ...TEST_STRATEGY.buy, requireToken1Balance: true, minToken1Balance: 500 },
  sell: { ...TEST_STRATEGY.sell, requireToken2Balance: true, minToken2Balance: 500 },
};

/** Requires the observed price to hold above the quote for the last 2 steps. */
export const TEST_STRATEGY_2STEPS: StrategyEngineConfig = {
  buy: { ...TEST_STRATEGY.buy, avgObservedHigherThanBuyForLastSteps: { steps: 2, percent: 0 } },
  sell: { ...TEST_STRATEGY.sell, avgObservedHigherThanSellForLastSteps: { steps: 2, percent: 0 } },
};

const startedBuyTx: TransactionEvent = { id: 'tx-1', side: 'buy', status: 'started' };
const finishedBuyTx: TransactionEvent = { id: 'tx-1', side: 'buy', status: 'finished', txHash: '0xabc' };

/** Single qualifying step: observed above both quotes, spread tiny. */
export const WINDOW_SINGLE: MarketStep[] = [step(1_000, 100, 101, 102)];

/** Two qualifying steps — satisfies a 2-step lookback. */
export const WINDOW_TWO_QUALIFY: MarketStep[] = [
  step(1_000, 100, 101, 102),
  step(2_000, 100, 101, 102),
];

/** Two steps where the FIRST fails (observed below buy quote) — 2-step lookback fails. */
export const WINDOW_TWO_MIXED: MarketStep[] = [
  step(1_000, 100, 101, 99), // avg 99 < buy 100 -> negative percent
  step(2_000, 100, 101, 102),
];

/** Current step carries an open (started, never finished) transaction. */
export const WINDOW_TX_OPEN: MarketStep[] = [
  step(1_000, 100, 101, 102, { events: { transaction: startedBuyTx } }),
];

/** Transaction started, then finished at t=6000 — no longer in progress. */
export const WINDOW_TX_CLOSED: MarketStep[] = [
  step(1_000, 100, 101, 102, { events: { transaction: startedBuyTx } }),
  step(6_000, 100, 101, 102, { events: { transaction: finishedBuyTx } }),
];

/** Current step carries token balances. */
export const WINDOW_WITH_BALANCES: MarketStep[] = [
  step(1_000, 100, 101, 102, { balances: { token1: 1000, token2: 1000 } }),
];
