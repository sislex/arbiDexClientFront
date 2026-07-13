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

function cartesian(dims: Dimension[], max: number): Record<string, number>[] {
  let combos: Record<string, number>[] = [{}];
  for (const d of dims) {
    const next: Record<string, number>[] = [];
    for (const c of combos) {
      for (const v of d.values) {
        next.push({ ...c, [d.label]: v });
        if (next.length >= max) break;
      }
      if (next.length >= max) break;
    }
    combos = next;
    if (combos.length >= max) break;
  }
  return combos.slice(0, max);
}

function applyCombo(strategy: StrategyConfigData, combo: Record<string, number>): StrategyConfigData {
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
  const comboParams = dims.length ? cartesian(dims, opts.maxCombos ?? 48) : [{}];
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
    combos,
    best: combos[0] ?? null,
  };
}
