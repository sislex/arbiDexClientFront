import type { AutotuneCombo, AutotuneResult, QuotePoint, StrategyConfig } from '../domain/types';
import { simulateBacktest } from './simulate';

interface Dimension {
  side: 'buy' | 'sell';
  conditionId: string;
  key: string;
  values: number[];
  /** Flattened label `side.conditionId.key`. */
  label: string;
}

function rangeValues(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  if (step <= 0) return [min];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/** Collect the tunable dimensions (params whose tune range is enabled). */
function collectDimensions(strategy: StrategyConfig): Dimension[] {
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

/** Cartesian product of dimension values, capped at `max` combos. */
/** Full size of the combination grid. */
function gridSize(dims: Dimension[]): number {
  return dims.reduce((p, d) => p * d.values.length, 1);
}

/** Up to `max` combos sampled uniformly across the whole grid (mixed-radix). */
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

function applyCombo(strategy: StrategyConfig, combo: Record<string, number>): StrategyConfig {
  const s: StrategyConfig = JSON.parse(JSON.stringify(strategy));
  for (const [label, value] of Object.entries(combo)) {
    const [side, conditionId, key] = label.split('.') as ['buy' | 'sell', string, string];
    const cond = s[side].find((c) => c.conditionId === conditionId);
    if (cond) cond.params[key] = value;
  }
  return s;
}

export function runAutotune(
  quotes: QuotePoint[],
  strategy: StrategyConfig,
  opts: { maxCombos?: number; initialBalance?: number; id?: string } = {},
): AutotuneResult {
  const dims = collectDimensions(strategy);
  const gridTotal = dims.length ? gridSize(dims) : 1;
  const comboParams = dims.length ? sampleGrid(dims, opts.maxCombos ?? 1000) : [{}];
  const combos: AutotuneCombo[] = comboParams.map((params, i) => {
    const s = applyCombo(strategy, params);
    const bt = simulateBacktest(quotes, s, { initialBalance: opts.initialBalance });
    return { id: `combo_${i}`, params, stats: bt.stats };
  });
  combos.sort((a, b) => b.stats.pnl - a.stats.pnl);
  return {
    id: opts.id ?? 'at',
    totalCombos: combos.length,
    gridTotal,
    combos: combos.slice(0, 500),
    best: combos[0] ?? null,
  };
}
