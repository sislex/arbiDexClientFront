import type { ConditionDef } from '../types';
import { enabledCondition } from './enabled';
import { noTransactionInProgressCondition } from './noTransactionInProgress';
import { avgObservedHigherForLastStepsCondition } from './avgObservedHigherForLastSteps';
import { spreadOkCondition } from './spreadOk';
import { transactionDelayOkCondition } from './transactionDelayOk';
import { balanceOkCondition } from './balanceOk';

/**
 * The built-in conditions, evaluated (AND-ed) for each side. Add a condition by
 * writing a `ConditionDef` and appending it here — `processStep` and
 * `prepareSteps` pick it up automatically.
 */
export const CONDITIONS: ConditionDef[] = [
  enabledCondition,
  noTransactionInProgressCondition,
  avgObservedHigherForLastStepsCondition,
  spreadOkCondition,
  transactionDelayOkCondition,
  balanceOkCondition,
];
