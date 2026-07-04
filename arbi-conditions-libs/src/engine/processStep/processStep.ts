/**
 * processStep — evaluate the current step against the strategy (engine core).
 *
 * This is the single source of truth for a one-step evaluation. The current
 * step is `steps[currentIndex]` (defaults to the LAST element); steps after it
 * are treated as future and ignored, and the earlier steps feed the lookback
 * conditions (e.g. "observed higher for the last N steps", "no transaction in
 * progress"). `processAllStepsAndRecordResults` is built on top of this.
 *
 * Pure and framework-agnostic: it orchestrates the predicates from
 * `./conditions` and the utilities from `./helpers`, and mutates nothing.
 * Throws when the resulting window is empty.
 *
 * @example
 * import { processStep } from '@sislex/arbi-conditions-libs';
 *
 * const result = processStep({ steps: window, strategy });
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
  ProcessStepParams,
  TradingConditionsStepResult,
} from '../types';

export function processStep({
  steps,
  strategy,
  currentIndex,
}: ProcessStepParams): TradingConditionsStepResult {
  // Everything up to and including the current step; later steps are the future.
  const window = currentIndex === undefined ? steps : steps.slice(0, currentIndex + 1);
  const current = lastStep(window);

  // ── Buy side ─────────────────────────────────────────────────────────────
  const buyEnabledOk = buyEnabled(window, strategy);
  const buyNoTxOk = buyNoTransactionInProgress(window, strategy);
  const buyAvgOk = buyAvgObservedHigherForLastSteps(window, strategy);
  const buySpreadOkResult = buySpreadOk(window, strategy);
  const buyDelayOk = buyTransactionDelayOk(window, strategy);
  const buyToken1Ok = buyToken1BalanceOk(window, strategy);

  const buyAll = buyEnabledOk
    && buyNoTxOk
    && buyAvgOk
    && buySpreadOkResult
    && buyDelayOk
    && buyToken1Ok;

  // ── Sell side ────────────────────────────────────────────────────────────
  const sellEnabledOk = sellEnabled(window, strategy);
  const sellNoTxOk = sellNoTransactionInProgress(window, strategy);
  const sellAvgOk = sellAvgObservedHigherForLastSteps(window, strategy);
  const sellSpreadOkResult = sellSpreadOk(window, strategy);
  const sellDelayOk = sellTransactionDelayOk(window, strategy);
  const sellToken2Ok = sellToken2BalanceOk(window, strategy);

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
      transactionInProgress: isTransactionInProgress(window),
      lastFinishedTransactionTime: lastFinishedTransactionTime(window),
    },
  };
}
