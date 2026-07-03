/**
 * processStep — evaluate the current step against the strategy (engine core).
 *
 * This is the single source of truth for a one-step evaluation. The current
 * step is the LAST element of `steps`; the earlier steps in the window feed the
 * lookback conditions (e.g. "observed higher for the last N steps", "no
 * transaction in progress"). `processStepArray` and
 * `processAllStepsAndRecordResults` are built on top of this by calling it over
 * a growing window.
 *
 * Pure and framework-agnostic: it orchestrates the predicates from
 * `./conditions` and the utilities from `./helpers`, and mutates nothing.
 * Throws when `steps` is empty.
 *
 * @example
 * import { processStep } from '@sislex/arbi-conditions-libs';
 *
 * const result = processStep(window, strategy);
 * // result.transaction.buy / .sell — whether all buy/sell conditions hold.
 */

import {
  buyAvgObservedHigherForLastSteps,
  buyEnabled,
  buyNoTransactionInProgress,
  buySpreadOk,
  buyToken1BalanceOk,
  buyTransactionDelayOk,
  sellAvgObservedHigherForLastSteps,
  sellEnabled,
  sellNoTransactionInProgress,
  sellSpreadOk,
  sellToken2BalanceOk,
  sellTransactionDelayOk,
} from './conditions';
import { isTransactionInProgress, lastFinishedTransactionTime, lastStep } from './helpers';
import type {
  MarketStep,
  StrategyEngineConfig,
  TradingConditionsStepResult,
} from '../types';

export function processStep(
  steps: MarketStep[],
  strategy: StrategyEngineConfig,
): TradingConditionsStepResult {
  const current = lastStep(steps);

  // ── Buy side ─────────────────────────────────────────────────────────────
  const buyEnabledOk = buyEnabled(steps, strategy);
  const buyNoTxOk = buyNoTransactionInProgress(steps, strategy);
  const buyAvgOk = buyAvgObservedHigherForLastSteps(steps, strategy);
  const buySpreadOkResult = buySpreadOk(steps, strategy);
  const buyDelayOk = buyTransactionDelayOk(steps, strategy);
  const buyToken1Ok = buyToken1BalanceOk(steps, strategy);

  const buyAll = buyEnabledOk
    && buyNoTxOk
    && buyAvgOk
    && buySpreadOkResult
    && buyDelayOk
    && buyToken1Ok;

  // ── Sell side ────────────────────────────────────────────────────────────
  const sellEnabledOk = sellEnabled(steps, strategy);
  const sellNoTxOk = sellNoTransactionInProgress(steps, strategy);
  const sellAvgOk = sellAvgObservedHigherForLastSteps(steps, strategy);
  const sellSpreadOkResult = sellSpreadOk(steps, strategy);
  const sellDelayOk = sellTransactionDelayOk(steps, strategy);
  const sellToken2Ok = sellToken2BalanceOk(steps, strategy);

  const sellAll = sellEnabledOk
    && sellNoTxOk
    && sellAvgOk
    && sellSpreadOkResult
    && sellDelayOk
    && sellToken2Ok;

  return {
    transaction: {
      buy: buyAll,
      sell: sellAll,
    },
    condition: {
      buy: {
        enabled: buyEnabledOk,
        no_transaction_in_progress: buyNoTxOk,
        avg_observed_higher_than_buy: buyAvgOk,
        avg_observed_higher_than_buy_for_last_steps: buyAvgOk,
        spread_ok: buySpreadOkResult,
        last_finished_transaction_delay_ok: buyDelayOk,
        token1_balance_ok: buyToken1Ok,
      },
      sell: {
        enabled: sellEnabledOk,
        no_transaction_in_progress: sellNoTxOk,
        avg_observed_higher_than_sell: sellAvgOk,
        avg_observed_higher_than_sell_for_last_steps: sellAvgOk,
        spread_ok: sellSpreadOkResult,
        last_finished_transaction_delay_ok: sellDelayOk,
        token2_balance_ok: sellToken2Ok,
      },
    },
    meta: {
      lastStepTime: current.time,
      transactionInProgress: isTransactionInProgress(steps),
      lastFinishedTransactionTime: lastFinishedTransactionTime(steps),
    },
  };
}
