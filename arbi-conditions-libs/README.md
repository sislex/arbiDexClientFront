# @sislex/arbi-conditions-libs

Framework-agnostic shared library (conditions / strategy engine) used by both the
`arbi-dex` Angular frontend and the `arbi-dex-server` NestJS backend.

> Pure TypeScript only. No Angular / NestJS / DOM / Node-specific APIs — anything
> environment-specific must be passed in or declared as a `peerDependency`.

## Analytics conditions

```ts
import { evaluateConfig, allConditionsMet, type ConditionsConfig } from '@sislex/arbi-conditions-libs';

// Same shape as arbi-configs/analytics/conditions.config.json
const config: ConditionsConfig = {
  version: 1,
  conditions: [
    { id: 'buy-observed-above', type: 'OBSERVED_ABOVE_BUY', thresholdPct: 0.02, enabled: true },
    { id: 'spread-within', type: 'SPREAD_WITHIN', thresholdPct: 0.03, enabled: true },
  ],
};

const ctx = { observedPrice: 100.5, buyPrice: 100, sellPrice: 100.02 };

evaluateConfig(config, ctx);   // [{ id, type, satisfied }, ...]
allConditionsMet(config, ctx); // boolean
```

## Strategy engine

Evaluates market steps against a buy/sell strategy and reports **which conditions
currently hold**. It is a pure evaluator — it does **not** decide BUY/SELL/WAIT or
track a position; the caller does that from the reported result.

### Window model

The engine works on a **window** of steps: an ordered `MarketStep[]` where the
**last element is the current step**. Conditions that need history read the earlier
steps straight from the window:

- `avg_observed_higher_than_*_for_last_steps` — inspects the last `N` steps.
- `no_transaction_in_progress` — a transaction is "in progress" while a `started`
  event has no later `finished`/`failed` for the same id anywhere in the window.
- `last_finished_transaction_delay_ok` — delay measured from the `time` of the most
  recent `finished` transaction to the current step.

An empty window throws.

### Config & steps

```ts
import {
  processStep,
  type StrategyEngineConfig,
  type MarketStep,
} from '@sislex/arbi-conditions-libs';

const strategy: StrategyEngineConfig = {
  buy: {
    enabled: true,
    requireNoTransactionInProgress: true,
    avgObservedHigherThanBuyForLastSteps: { steps: 2, percent: 0.1 },
    maxBuySellSpreadPercent: 0.5,
    minDelayAfterLastFinishedTransactionMs: 5_000,
    requireToken1Balance: true,
    minToken1Balance: 100,
  },
  sell: {
    enabled: true,
    requireNoTransactionInProgress: true,
    avgObservedHigherThanSellForLastSteps: { steps: 2, percent: 0.1 },
    maxBuySellSpreadPercent: 0.5,
    minDelayAfterLastFinishedTransactionMs: 5_000,
    requireToken2Balance: true,
    minToken2Balance: 100,
    // Optional position TRIGGERS (OR-ed into transaction.forcedSell):
    stopLossPercent: 2,             // sell if bid falls 2% below entry
    trailingTakeProfitPercent: 1,   // sell on a 1% pullback from the post-entry peak
    maxHoldingTimeMs: 3_600_000,    // sell after 1h in position
  },
};

const steps: MarketStep[] = [
  { time: 1_000, quotes: { buyQuote: 100, sellQuote: 100.2, avgObservedQuote: 100.6 }, balances: { token1: 1000, token2: 1000 } },
  { time: 2_000, quotes: { buyQuote: 100, sellQuote: 100.2, avgObservedQuote: 100.7 }, balances: { token1: 1000, token2: 1000 } },
];
```

### Entry points

**`processStep({ steps, strategy })`** — evaluate the current (last) step over the window:

```ts
const result = processStep({ steps, strategy });

result.transaction.buy;   // true when ALL buy-side conditions pass
result.transaction.sell;  // true when ALL sell-side conditions pass
result.condition.buy;     // per-condition booleans (enabled, spread_ok, ...)
result.condition.sell;
result.meta;              // { lastStepTime, transactionInProgress, lastFinishedTransactionTime }
```

By default the current step is the last of `steps`. Pass `currentIndex` to pin it
elsewhere — steps after it are treated as future and ignored:

```ts
processStep({ steps: history, strategy, currentIndex: 42 }); // current = history[42]
```

**`prepareSteps({ steps, strategy, currentIndex? })`** — trim a full history down
to the minimal window `processStep` needs, then pipe it straight in. It returns a
`ProcessStepParams` with the trimmed `steps`:

```ts
import { prepareSteps, processStep } from '@sislex/arbi-conditions-libs';

const result = processStep(prepareSteps({ steps: history, strategy }));
```

The kept window is the largest requirement across the strategy's conditions:
- `avgObservedHigher*ForLastSteps` → the last `steps` entries;
- `minDelayAfterLastFinishedTransactionMs` → steps within that delay of the current step;
- `requireNoTransactionInProgress` → back to the most recent transaction event;
- `enabled` / `spread` / `balance` → the current step only.

**`processAllStepsAndRecordResults(steps, strategy, options?)`** — same run, but
returns `records` pairing each step with its index and result, and calls an
optional `onRecord` callback as each step is processed:

```ts
import { processAllStepsAndRecordResults } from '@sislex/arbi-conditions-libs';

const { records } = processAllStepsAndRecordResults(steps, strategy, {
  onRecord: (r) => console.log(r.index, r.result.transaction.buy),
});
// records: Array<{ index, step, result }>
```

### Result shape

`TradingConditionsStepResult`. Each condition reports a structured outcome
(`{ passed, actual?, required? }`), keyed by condition id, per side:

```ts
{
  transaction: {
    buy: boolean;                 // ALL buy GATE conditions passed
    sell: boolean;                // ALL sell GATE conditions passed
    forcedSell: boolean;          // a sell TRIGGER fired (OR: stop-loss / trailing / max-hold)
  };
  condition: {
    buy:  Record<GateConditionId, { passed; actual?; required? }>;              // gates
    sell: Record<GateConditionId | TriggerConditionId, { passed; actual?; required? }>; // gates + triggers
  };
  meta: {
    lastStepTime: number;
    transactionInProgress: boolean;
    lastFinishedTransactionTime: number | null;
  };
}

// e.g. result.condition.buy.spread_ok -> { passed: true, actual: -0.99, required: 100 }
//      result.condition.sell.stop_loss?.passed -> whether the stop-loss trigger fired
```

Built-in **gate** ids (AND-ed): `enabled`, `no_transaction_in_progress`,
`avg_observed_higher_for_last_steps`, `spread_ok`, `transaction_delay_ok`,
`balance_ok`. Built-in **trigger** ids (OR-ed into `forcedSell`, sell side only):
`stop_loss`, `trailing_take_profit`, `max_holding_time`. Gate ids are always
present in the outcome map; trigger/custom ids are accessed as possibly-undefined.

### Conditions are pluggable

Each condition is a self-describing `ConditionDef` in a registry (`CONDITIONS`
for gates, `TRIGGER_CONDITIONS` for sell triggers): it declares how much history
it needs (`window`) and how to evaluate itself (`evaluate`, returning
`{ passed, actual?, required? }`). Both `processStep` and `prepareSteps` iterate
the registries, so **adding a condition is a single new `ConditionDef`** — no
changes to the engine core.

Pass custom sets at runtime via the `conditions` (gates) and `triggerConditions`
(sell triggers) params; both flow through `prepareSteps` into `processStep`:

```ts
processStep({ steps, strategy, position, conditions: [...CONDITIONS, myGate] });
processStep({ steps, strategy, position, triggerConditions: [...TRIGGER_CONDITIONS, myTrigger] });
// or evaluate one side directly:
evaluateSide(ctx, strategy, 'buy', myConditions);
```

**Position triggers.** `processStep` reads `ctx.position` (`{ entryPrice, size,
openedAt }`, passed via `position`). The built-in triggers (`stop_loss`,
`trailing_take_profit`, `max_holding_time`) fire only with an open position and
their config field set. `prepareSteps` keeps history back to `position.openedAt`
when a condition needs it (`sincePositionOpen`).

`evaluate` receives an `EvalContext` (`{ window, current, position }`), so
position-aware conditions (take-profit, stop-loss, PnL, max holding time) can be
added by passing `position` into `processStep`/`prepareSteps`.

## Build

```bash
npm run build --workspace @sislex/arbi-conditions-libs   # ESM + CJS + .d.ts -> dist/
npm run dev   --workspace @sislex/arbi-conditions-libs   # watch mode
npm test      --workspace @sislex/arbi-conditions-libs   # vitest
```

## Publish

```bash
npm login
npm publish --workspace @sislex/arbi-conditions-libs     # public scoped package
```

Bump the version (`npm version patch --workspace @sislex/arbi-conditions-libs`)
before each publish.
