/**
 * worker_threads entry for the parallel autotune: runs a backtest for its
 * chunk of combos and STREAMS the results back in batches (`{type:'batch'}`
 * messages, then `{type:'done'}`) so the parent can report live progress.
 * Spawned by `runAutotuneParallel` (autotune.ts) with `workerData` input.
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

/** Batch size ~ progress granularity vs postMessage overhead. */
const BATCH_SIZE = 20;
/** Flush at least this often even mid-batch — the UI counter must move no
 * rarer than every few seconds even when a single backtest is slow. */
const FLUSH_MS = 2000;

const { steps, strategy, combos, initialBalance } = workerData as WorkerInput;

let batch: AutotuneCombo[] = [];
let lastFlush = Date.now();
const flush = (): void => {
  if (batch.length === 0) return;
  parentPort!.postMessage({ type: 'batch', combos: batch });
  batch = [];
  lastFlush = Date.now();
};

for (const { index, params } of combos) {
  const s = applyCombo(strategy, params);
  const { strategy: engineStrategy, gates, triggers } = toEngineStrategy(s.buy, s.sell);
  const bt = runBacktest(steps, engineStrategy, {
    initialBalance,
    conditions: gates,
    triggerConditions: triggers,
  });
  batch.push({ id: `combo_${index}`, params, stats: bt.stats });
  if (batch.length >= BATCH_SIZE || Date.now() - lastFlush >= FLUSH_MS) flush();
}
flush();
parentPort!.postMessage({ type: 'done' });
