/**
 * worker_threads entry for the parallel autotune: runs a backtest for its
 * chunk of combos and posts the ranked-ready results back. Spawned by
 * `runAutotuneParallel` (autotune.ts) with `workerData` input.
 */
import { parentPort, workerData } from 'worker_threads';
import { runBacktest } from '@sislex/arbi-conditions-libs';
import type { MarketStep } from '@sislex/arbi-conditions-libs';
import { toEngineStrategy } from './strategy-engine.mapper';
import { applyCombo } from './autotune';
import { AutotuneCombo, StrategyConfigData } from './types';

interface WorkerInput {
  steps: MarketStep[];
  strategy: StrategyConfigData;
  combos: { index: number; params: Record<string, number> }[];
  initialBalance?: number;
}

const { steps, strategy, combos, initialBalance } = workerData as WorkerInput;

const out: AutotuneCombo[] = combos.map(({ index, params }) => {
  const s = applyCombo(strategy, params);
  const { strategy: engineStrategy, gates, triggers } = toEngineStrategy(s.buy, s.sell);
  const bt = runBacktest(steps, engineStrategy, {
    initialBalance,
    conditions: gates,
    triggerConditions: triggers,
  });
  return { id: `combo_${index}`, params, stats: bt.stats };
});

parentPort!.postMessage(out);
