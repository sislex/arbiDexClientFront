import type { StrategyConfig } from '../../domain/types';
import { getCatalogEntry } from '../../domain/conditionsCatalog';

/** Human label for a flattened tune key `side.conditionId.param`. */
export function tuneKeyLabel(label: string): string {
  const [side, conditionId, param] = label.split('.');
  const entry = getCatalogEntry(conditionId);
  const p = entry?.params.find((x) => x.key === param);
  const sideStr = side === 'buy' ? '▲' : '▼';
  const unit = p?.unit ? ` (${p.unit})` : '';
  return `${sideStr} ${p?.label ?? param}${unit}`;
}

/** Apply a flattened combo onto a strategy, returning new buy/sell arrays. */
export function applyComboToStrategy(strategy: StrategyConfig, params: Record<string, number>) {
  const clone: StrategyConfig = JSON.parse(JSON.stringify(strategy));
  for (const [label, value] of Object.entries(params)) {
    const [side, conditionId, key] = label.split('.') as ['buy' | 'sell', string, string];
    const cond = clone[side].find((c) => c.conditionId === conditionId);
    if (cond) cond.params[key] = value;
  }
  return { buy: clone.buy, sell: clone.sell };
}
