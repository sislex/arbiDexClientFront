/** Conditions catalog — mirrors `arbi-dex-react` and `arbi-conditions-libs`.
 * Each param carries a default, an editing range, and an optional auto-tune
 * range (feature 8). Single source of truth for the demo engine + served to
 * the frontend via GET /conditions-catalog. */

import { Side, StrategyConditionValue, TuneRange } from './types';

export interface ConditionParam {
  key: string;
  label: string;
  unit?: string;
  type: 'number' | 'boolean';
  default: number | boolean;
  min?: number;
  max?: number;
  step?: number;
  tunable?: boolean;
  tuneDefault?: TuneRange;
}

export interface ConditionCatalogEntry {
  id: string;
  title: string;
  description: string;
  kind: 'gate' | 'trigger';
  sides: Side[];
  params: ConditionParam[];
}

export const CONDITIONS_CATALOG: ConditionCatalogEntry[] = [
  {
    id: 'enabled',
    title: 'Сторона включена',
    description: 'Разрешает торговлю на этой стороне (buy/sell).',
    kind: 'gate',
    sides: ['buy', 'sell'],
    params: [{ key: 'enabled', label: 'Включено', type: 'boolean', default: true }],
  },
  {
    id: 'no_transaction_in_progress',
    title: 'Нет активной транзакции',
    description: 'Не открывать новую сделку, пока предыдущая не завершилась.',
    kind: 'gate',
    sides: ['buy', 'sell'],
    params: [{ key: 'require', label: 'Требовать', type: 'boolean', default: true }],
  },
  {
    id: 'avg_observed_higher_for_last_steps',
    title: 'Отклонение от средневзвешенной',
    description:
      'Цена на торговом рынке отклонилась от средневзвешенной наблюдаемой на ≥ percent% в течение последних N шагов.',
    kind: 'gate',
    sides: ['buy', 'sell'],
    params: [
      {
        key: 'steps',
        label: 'Шагов подряд',
        type: 'number',
        default: 3,
        min: 1,
        max: 30,
        step: 1,
        tunable: true,
        tuneDefault: { min: 1, max: 10, step: 1, enabled: false },
      },
      {
        key: 'percent',
        label: 'Порог отклонения',
        unit: '%',
        type: 'number',
        default: 0.5,
        min: 0,
        max: 10,
        step: 0.05,
        tunable: true,
        tuneDefault: { min: 0.1, max: 2, step: 0.1, enabled: true },
      },
    ],
  },
  {
    id: 'spread_ok',
    title: 'Спред в норме',
    description: 'Спред buy/sell на текущем шаге не превышает максимум.',
    kind: 'gate',
    sides: ['buy', 'sell'],
    params: [
      {
        key: 'maxSpreadPercent',
        label: 'Макс. спред',
        unit: '%',
        type: 'number',
        default: 1,
        min: 0,
        max: 10,
        step: 0.05,
        tunable: true,
        tuneDefault: { min: 0.2, max: 2, step: 0.2, enabled: false },
      },
    ],
  },
  {
    id: 'transaction_delay_ok',
    title: 'Задержка между сделками',
    description: 'Минимальная пауза после последней завершённой транзакции.',
    kind: 'gate',
    sides: ['buy', 'sell'],
    params: [
      {
        key: 'minDelayMs',
        label: 'Мин. задержка',
        unit: 'мс',
        type: 'number',
        default: 5000,
        min: 0,
        max: 120000,
        step: 500,
        tunable: true,
        tuneDefault: { min: 0, max: 30000, step: 5000, enabled: false },
      },
    ],
  },
  {
    id: 'balance_ok',
    title: 'Достаточный баланс',
    description: 'Требовать минимальный баланс актива для входа в сделку.',
    kind: 'gate',
    sides: ['buy', 'sell'],
    params: [
      { key: 'require', label: 'Требовать', type: 'boolean', default: true },
      {
        key: 'minBalance',
        label: 'Мин. баланс',
        type: 'number',
        default: 10,
        min: 0,
        max: 100000,
        step: 10,
      },
    ],
  },
  {
    id: 'stop_loss',
    title: 'Стоп-лосс',
    description: '% убытка от цены входа, при котором позиция принудительно продаётся.',
    kind: 'trigger',
    sides: ['sell'],
    params: [
      {
        key: 'stopLossPercent',
        label: 'Стоп-лосс',
        unit: '%',
        type: 'number',
        default: 2,
        min: 0,
        max: 50,
        step: 0.1,
        tunable: true,
        tuneDefault: { min: 1, max: 5, step: 0.5, enabled: true },
      },
    ],
  },
  {
    id: 'trailing_take_profit',
    title: 'Trailing take-profit',
    description: '% отката от пика цены после входа, фиксирующий прибыль.',
    kind: 'trigger',
    sides: ['sell'],
    params: [
      {
        key: 'trailingTakeProfitPercent',
        label: 'Trailing TP',
        unit: '%',
        type: 'number',
        default: 1,
        min: 0,
        max: 50,
        step: 0.1,
        tunable: true,
        tuneDefault: { min: 0.5, max: 3, step: 0.5, enabled: true },
      },
    ],
  },
  {
    id: 'max_holding_time',
    title: 'Макс. время удержания',
    description: 'Принудительная продажа по истечении времени удержания позиции.',
    kind: 'trigger',
    sides: ['sell'],
    params: [
      {
        key: 'maxHoldingTimeMs',
        label: 'Макс. удержание',
        unit: 'мс',
        type: 'number',
        default: 300000,
        min: 0,
        max: 3600000,
        step: 30000,
        tunable: true,
        tuneDefault: { min: 60000, max: 900000, step: 60000, enabled: false },
      },
    ],
  },
];

export function getCatalogEntry(id: string): ConditionCatalogEntry | undefined {
  return CONDITIONS_CATALOG.find((c) => c.id === id);
}

export function defaultConditionValue(entry: ConditionCatalogEntry): StrategyConditionValue {
  const params: Record<string, number | boolean> = {};
  const tuneRanges: Record<string, TuneRange> = {};
  for (const p of entry.params) {
    params[p.key] = p.default;
    if (p.tunable && p.tuneDefault) tuneRanges[p.key] = { ...p.tuneDefault };
  }
  return { conditionId: entry.id, enabled: true, params, tuneRanges };
}

export function defaultStrategySides(): {
  buy: StrategyConditionValue[];
  sell: StrategyConditionValue[];
} {
  const buy = CONDITIONS_CATALOG.filter((c) => c.sides.includes('buy')).map(defaultConditionValue);
  const sell = CONDITIONS_CATALOG.filter((c) => c.sides.includes('sell')).map(defaultConditionValue);
  return { buy, sell };
}
