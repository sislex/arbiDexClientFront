import type { TradingRuleDefinition, TradingRuleState } from '../types/tradingRules'

export const TRADING_RULE_DEFINITIONS: TradingRuleDefinition[] = [
  {
    id: 'buy-1',
    number: 1,
    side: 'buy',
    parts: [
      { type: 'text', text: 'Если Средняя цена выше покупки за последние N шагов (процент) >= ' },
      { type: 'param', key: 'percent', suffix: ' %', width: 56 },
    ],
    defaults: { percent: 1 },
    defaultEnabled: true,
  },
  {
    id: 'buy-2',
    number: 2,
    side: 'buy',
    parts: [
      { type: 'text', text: 'Если Количество шагов для проверки покупки >= ' },
      { type: 'param', key: 'steps', suffix: ' шагов', width: 56 },
    ],
    defaults: { steps: 5 },
    defaultEnabled: true,
  },
  {
    id: 'buy-8',
    number: 8,
    side: 'buy',
    parts: [
      { type: 'text', text: 'Если Цена покупки не превышает цену продажи более чем на ' },
      { type: 'param', key: 'percent', suffix: ' %', width: 56 },
    ],
    defaults: { percent: 50 },
    defaultEnabled: true,
  },
  {
    id: 'buy-6',
    number: 6,
    side: 'buy',
    parts: [{ type: 'text', text: 'Если Нет текущей транзакции' }],
    defaults: {},
    defaultEnabled: true,
  },
  {
    id: 'buy-5',
    number: 5,
    side: 'buy',
    parts: [
      { type: 'text', text: 'Если Прошло больше ' },
      { type: 'param', key: 'ms', suffix: ' ms с последней транзакции', width: 72 },
    ],
    defaults: { ms: 60000 },
    defaultEnabled: true,
  },
  {
    id: 'buy-10',
    number: 10,
    side: 'buy',
    parts: [
      { type: 'text', text: 'Если Минимальный баланс USDT для покупки >= ' },
      { type: 'param', key: 'percent', suffix: ' %', width: 64 },
    ],
    defaults: { percent: 1000 },
    defaultEnabled: false,
  },
  {
    id: 'sell-3',
    number: 3,
    side: 'sell',
    parts: [
      { type: 'text', text: 'Если Средняя цена выше продажи за последние N шагов (процент) >= ' },
      { type: 'param', key: 'percent', suffix: ' %', width: 56 },
    ],
    defaults: { percent: 1 },
    defaultEnabled: true,
  },
  {
    id: 'sell-4',
    number: 4,
    side: 'sell',
    parts: [
      { type: 'text', text: 'Если Количество шагов для проверки продажи >= ' },
      { type: 'param', key: 'steps', suffix: ' шагов', width: 56 },
    ],
    defaults: { steps: 5 },
    defaultEnabled: true,
  },
  {
    id: 'sell-7',
    number: 7,
    side: 'sell',
    parts: [{ type: 'text', text: 'Если Нет текущей транзакции' }],
    defaults: {},
    defaultEnabled: true,
  },
  {
    id: 'sell-9',
    number: 9,
    side: 'sell',
    parts: [
      { type: 'text', text: 'Если Прошло больше ' },
      { type: 'param', key: 'ms', suffix: ' ms с последней транзакции', width: 72 },
    ],
    defaults: { ms: 60000 },
    defaultEnabled: true,
  },
  {
    id: 'sell-11',
    number: 11,
    side: 'sell',
    parts: [
      { type: 'text', text: 'Если Минимальный баланс USDT для продажи >= ' },
      { type: 'param', key: 'percent', suffix: ' %', width: 64 },
    ],
    defaults: { percent: 1000 },
    defaultEnabled: false,
  },
]

export function createDefaultTradingRules(): TradingRuleState[] {
  return TRADING_RULE_DEFINITIONS.map((def) => ({
    id: def.id,
    enabled: def.defaultEnabled,
    values: { ...def.defaults },
  }))
}

export function getRuleDefinition(id: string): TradingRuleDefinition | undefined {
  return TRADING_RULE_DEFINITIONS.find((d) => d.id === id)
}
