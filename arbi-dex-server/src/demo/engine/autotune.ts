import { Worker } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';
import { AutotuneCombo, AutotuneResult, QuotePoint, StrategyConfigData } from './types';
import { toEngineStrategy } from './strategy-engine.mapper';
import { runBacktest } from '@sislex/arbi-conditions-libs';
import type { MarketStep } from '@sislex/arbi-conditions-libs';

export interface Dimension {
  side: 'buy' | 'sell';
  conditionId: string;
  key: string;
  values: number[];
  label: string;
}

/** Стабильный ключ комбинации — для дедупликации между раундами уточнения. */
export function comboKey(params: Record<string, number>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('|');
}

/**
 * Случайный поиск: у каждого измерения выбирается случайное значение.
 * В отличие от равномерного сэмпла (регулярная решётка по mixed-radix, которая
 * может систематически пропускать области между узлами), случайные точки не
 * имеют такого смещения — на огромных сетках это полезная альтернатива.
 * Повторы отсеиваются по ключу комбинации.
 */
export function sampleRandom(dims: Dimension[], count: number): Record<string, number>[] {
  if (dims.length === 0 || count <= 0) return [{}];
  const total = gridSize(dims);
  const target = Math.min(count, total);
  const seen = new Set<string>();
  const out: Record<string, number>[] = [];
  // Запас попыток на случай коллизий; при почти полном покрытии сетки
  // добиваем оставшееся равномерным сэмплом.
  let attempts = target * 20;
  while (out.length < target && attempts-- > 0) {
    const combo: Record<string, number> = {};
    for (const d of dims) combo[d.label] = d.values[Math.floor(Math.random() * d.values.length)];
    const key = comboKey(combo);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(combo);
  }
  if (out.length < target) {
    for (const combo of sampleGrid(dims, total)) {
      if (out.length >= target) break;
      const key = comboKey(combo);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(combo);
    }
  }
  return out;
}

/**
 * Следующий раунд уточняющего перебора (coarse-to-fine): по топ-результатам
 * прошлого раунда сужаем диапазон каждого измерения до [min..max] значений в
 * топе, расширенного на один шаг сетки в обе стороны, и равномерно сэмплируем
 * уменьшенную сетку. Так гигантские сетки (миллиарды комбинаций) сходятся к
 * хорошим областям за тысячи прогонов вместо полного перебора.
 */
export function buildRefineRound(
  dims: Dimension[],
  topCombos: { params: Record<string, number> }[],
  count: number,
  seen: Set<string>,
): Record<string, number>[] {
  if (dims.length === 0 || topCombos.length === 0 || count <= 0) return [];
  const refined: Dimension[] = dims.map((d) => {
    const used = topCombos
      .map((c) => c.params[d.label])
      .filter((v): v is number => typeof v === 'number');
    if (used.length === 0) return d;
    const idxs = used
      .map((v) => d.values.findIndex((x) => Math.abs(x - v) < 1e-9))
      .filter((i) => i >= 0);
    if (idxs.length === 0) return d;
    const lo = Math.max(0, Math.min(...idxs) - 1);
    const hi = Math.min(d.values.length - 1, Math.max(...idxs) + 1);
    return { ...d, values: d.values.slice(lo, hi + 1) };
  });
  // Сэмплируем с запасом: часть комбинаций уже выполнена в прошлых раундах.
  const sampled = sampleGrid(refined, count * 3);
  const fresh: Record<string, number>[] = [];
  for (const params of sampled) {
    const key = comboKey(params);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(params);
    if (fresh.length >= count) break;
  }
  return fresh;
}

function rangeValues(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  if (step <= 0) return [min];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function collectDimensions(strategy: StrategyConfigData): Dimension[] {
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
export function gridSize(dims: Dimension[]): number {
  return dims.reduce((p, d) => p * d.values.length, 1);
}

/** Grid size + actual run count for the UI estimate (no backtests executed). */
export function estimateGrid(
  strategy: StrategyConfigData,
  maxCombos = 1000,
): { gridTotal: number; combosToRun: number; dimensions: number } {
  const dims = collectDimensions(strategy);
  const gridTotal = dims.length ? gridSize(dims) : 1;
  return {
    gridTotal,
    combosToRun: dims.length ? Math.min(gridTotal, Math.max(1, maxCombos)) : 1,
    dimensions: dims.length,
  };
}

/**
 * Up to `max` combos sampled UNIFORMLY across the whole grid (mixed-radix
 * index decoding) — unlike a truncated cartesian product, the sample spans
 * every dimension's range instead of only wiggling the last one.
 */
export function sampleGrid(dims: Dimension[], max: number): Record<string, number>[] {
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

/** Live progress callback: called with each freshly finished batch of combos. */
export type AutotuneProgress = (batch: AutotuneCombo[]) => void;

export function runAutotune(
  quotes: QuotePoint[],
  strategy: StrategyConfigData,
  opts: { maxCombos?: number; initialBalance?: number; id?: string; onProgress?: AutotuneProgress } = {},
): AutotuneResult {
  const dims = collectDimensions(strategy);
  const gridTotal = dims.length ? gridSize(dims) : 1;
  const comboParams = dims.length ? sampleGrid(dims, opts.maxCombos ?? 1000) : [{}];
  // Build the step window once; each combo only re-maps the strategy.
  const steps: MarketStep[] = quotes.map((q) => ({
    time: q.time,
    quotes: { buyQuote: q.buyQuote, sellQuote: q.sellQuote, avgObservedQuote: q.avgObservedQuote },
  }));
  let progressBatch: AutotuneCombo[] = [];
  const combos: AutotuneCombo[] = comboParams.map((params, i) => {
    const s = applyCombo(strategy, params);
    const { strategy: engineStrategy, gates, triggers } = toEngineStrategy(s.buy, s.sell);
    const bt = runBacktest(steps, engineStrategy, {
      initialBalance: opts.initialBalance,
      conditions: gates,
      triggerConditions: triggers,
    });
    const combo = { id: `combo_${i}`, params, stats: bt.stats };
    if (opts.onProgress) {
      progressBatch.push(combo);
      if (progressBatch.length >= 20) {
        opts.onProgress(progressBatch);
        progressBatch = [];
      }
    }
    return combo;
  });
  if (opts.onProgress && progressBatch.length > 0) opts.onProgress(progressBatch);
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
  opts: {
    maxCombos?: number;
    initialBalance?: number;
    id?: string;
    threads?: number;
    onProgress?: AutotuneProgress;
  } = {},
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
  type WorkerMsg = { type: 'batch'; combos: AutotuneCombo[] } | { type: 'done' };
  const results = await Promise.all(
    chunks.map(
      (chunk) =>
        new Promise<AutotuneCombo[]>((resolve, reject) => {
          const w = new Worker(workerFile, {
            workerData: { steps, strategy, combos: chunk, initialBalance: opts.initialBalance },
          });
          const acc: AutotuneCombo[] = [];
          w.on('message', (msg: WorkerMsg) => {
            if (msg.type === 'batch') {
              acc.push(...msg.combos);
              opts.onProgress?.(msg.combos);
            } else if (msg.type === 'done') {
              resolve(acc);
            }
          });
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
