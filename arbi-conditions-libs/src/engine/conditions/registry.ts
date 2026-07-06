import type { ConditionDef } from '../types';
import { enabledCondition } from './enabled';
import { noTransactionInProgressCondition } from './noTransactionInProgress';
import { avgObservedHigherForLastStepsCondition } from './avgObservedHigherForLastSteps';
import { spreadOkCondition } from './spreadOk';
import { transactionDelayOkCondition } from './transactionDelayOk';
import { balanceOkCondition } from './balanceOk';
import { stopLossCondition } from './stopLoss';
import { trailingTakeProfitCondition } from './trailingTakeProfit';
import { maxHoldingTimeCondition } from './maxHoldingTime';

/**
 * Built-in GATE conditions — AND-ed per side to produce the buy/sell signal.
 * Add a gate by writing a `ConditionDef` and appending it here; `processStep`
 * and `prepareSteps` pick it up automatically.
 */
export const CONDITIONS: ConditionDef[] = [
  enabledCondition,
  noTransactionInProgressCondition,
  avgObservedHigherForLastStepsCondition,
  spreadOkCondition,
  transactionDelayOkCondition,
  balanceOkCondition,
];

/**
 * Built-in sell TRIGGER conditions — OR-ed into `transaction.forcedSell`. They
 * fire independently of the sell gates and only with an open position.
 */
export const TRIGGER_CONDITIONS: ConditionDef[] = [
  stopLossCondition,
  trailingTakeProfitCondition,
  maxHoldingTimeCondition,
];
