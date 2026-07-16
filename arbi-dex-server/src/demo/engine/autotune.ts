import { Worker } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';
import { AutotuneCombo, AutotuneResult, QuotePoint, StrategyConfigData } from './types';
import { toEngineStrategy } from './strategy-engine.mapper';
import { runBacktest } from '@sislex/arbi-conditions-libs';
import type { MarketStep } from '@sislex/arbi-conditions-libs';

interface Dimension {
  side: 'buy' | 'sell';
  conditionId: string;
  key: string;
  values: number[];
  label: string;
}

function rangeValues(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  if (step <= 0) return [min];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

function collectDimensions(strategy: StrategyConfigData): Dimension[] {
  const dims: Dimension[] = [];
  (['buy', 'sell'] as const).forEach((side) => {
    for (const cond of strategy[side]) {
      if (!cond.enabled) continue;
      for (const [key, range] of Object.entries(cond.tuneRanges)) {
        if (!range.enabled) continue;
        const values = rangeValues(range.min, range.max, range.step);
        if (values.length > 1) {
          dims.push({ side, conditionId: cond.conditionId, key, values, label: `${side}.${cond.conditionId}.${key}` });
        }
      }
    }
  });
  return dims;
}

/** Full size of the combination grid. */
function gridSize(dims: Dimension[]): number {
  return dims.reduce((p, d) => p * d.values.length, 1);
}

/**
 * Up to `max` combos sampled UNIFORMLY across the whole grid (mixed-radix
 * index decoding) — unlike a truncated cartesian product, the sample spans
 * every dimension's range instead of only wiggling the last one.
 */
function sampleGrid(dims: Dimension[], max: number): Record<string, number>[] {
  const total = gridSize(dims);
  const count = Math.min(total, Math.max(1, max));
  const combos: Record<string, number>[] = [];
  for (let i = 0; i < count; i++) {
    let idx = count === total ? i : Math.floor((i * total) / count);
    const combo: Record<string, number> = {};
    for (let d = dims.length - 1; d >= 0; d--) {
      const dim = dims[d];
      combo[dim.label] = dim.values[idx % dim.values.length];
      idx = Math.floor(idx / dim.values.length);
    }
    combos.push(combo);
  }
  return combos;
}

export function applyCombo(strategy: StrategyConfigData, combo: Record<string, number>): StrategyConfigData {
  const s: StrategyConfigData = JSON.parse(JSON.stringify(strategy));
  for (const [label, value] of Object.entries(combo)) {
    const [side, conditionId, key] = label.split('.') as ['buy' | 'sell', string, string];
    const cond = s[side].find((c) => c.conditionId === conditionId);
    if (cond) cond.params[key] = value;
  }
  return s;
}

export function runAutotune(
  quotes: QuotePoint[],
  strategy: StrategyConfigData,
  opts: { maxCombos?: number; initialBalance?: number; id?: string } = {},
): AutotuneResult {
  const dims = collectDimensions(strategy);
  const gridTotal = dims.length ? gridSize(dims) : 1;
  const comboParams = dims.length ? sampleGrid(dims, opts.maxCombos ?? 1000) : [{}];
  // Build the step window once; each combo only re-maps the strategy.
  const steps: MarketStep[] = quotes.map((q) => ({
    time: q.time,
    quotes: { buyQuote: q.buyQuote, sellQuote: q.sellQuote, avgObservedQuote: q.avgObservedQuote },
  }));
  const combos: AutotuneCombo[] = comboParams.map((params, i) => {
    const s = applyCombo(strategy, params);
    const { strategy: engineStrategy, gates, triggers } = toEngineStrategy(s.buy, s.sell);
    const bt = runBacktest(steps, engineStrategy, {
      initialBalance: opts.initialBalance,
      conditions: gates,
      triggerConditions: triggers,
    });
    return { id: `combo_${i}`, params, stats: bt.stats };
  });
  combos.sort((a, b) => b.stats.pnl - a.stats.pnl);
  return {
    id: opts.id ?? 'at',
    totalCombos: combos.length,
    gridTotal,
    // The grid can be huge — return only the top of the ranking (the run count
    // stays in totalCombos).
    combos: combos.slice(0, 500),
    best: combos[0] ?? null,
  };
}

/**
 * Parallel autotune: the sampled combos are split across worker_threads (the
 * sweep is pure CPU work, so N workers give a near-linear speed-up). Falls
 * back to the synchronous `runAutotune` for a single thread. `threads`
 * defaults to min(6, cores − 1).
 */
export async function runAutotuneParallel(
  quotes: QuotePoint[],
  strategy: StrategyConfigData,
  opts: { maxCombos?: number; initialBalance?: number; id?: string; threads?: number } = {},
): Promise<AutotuneResult> {
  const dims = collectDimensions(strategy);
  const gridTotal = dims.length ? gridSize(dims) : 1;
  const comboParams = dims.length ? sampleGrid(dims, opts.maxCombos ?? 1000) : [{}];

  const cores = os.availableParallelism?.() ?? os.cpus().length;
  const threads = Math.max(
    1,
    Math.min(opts.threads ?? Math.min(6, cores - 1), comboParams.length),
  );
  if (threads === 1) return runAutotune(quotes, strategy, opts);

  const steps: MarketStep[] = quotes.map((q) => ({
    time: q.time,
    quotes: { buyQuote: q.buyQuote, sellQuote: q.sellQuote, avgObservedQuote: q.avgObservedQuote },
  }));

  // Contiguous chunks, one per worker.
  const indexed = comboParams.map((params, index) => ({ index, params }));
  const chunkSize = Math.ceil(indexed.length / threads);
  const chunks = Array.from({ length: threads }, (_, i) =>
    indexed.slice(i * chunkSize, (i + 1) * chunkSize),
  ).filter((c) => c.length > 0);

  const workerFile = path.join(__dirname, 'autotune.worker.js');
  const results = await Promise.all(
    chunks.map(
      (chunk) =>
        new Promise<AutotuneCombo[]>((resolve, reject) => {
          const w = new Worker(workerFile, {
            workerData: { steps, strategy, combos: chunk, initialBalance: opts.initialBalance },
          });
          w.once('message', (msg: AutotuneCombo[]) => resolve(msg));
          w.once('error', reject);
          w.once('exit', (code) => {
            if (code !== 0) reject(new Error(`autotune worker exited with code ${code}`));
          });
        }),
    ),
  );

  const combos = results.flat();
  combos.sort((a, b) => b.stats.pnl - a.stats.pnl);
  return {
    id: opts.id ?? 'at',
    totalCombos: combos.length,
    gridTotal,
    combos: combos.slice(0, 500),
    best: combos[0] ?? null,
  };
}
