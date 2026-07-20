/** Human-readable labels for server/engine condition ids (mirrors arbi-dex-server catalog). */

export interface ConditionCatalogEntry {
  id: string
  title: string
  valueUnit?: string
}

export const CONDITIONS_CATALOG: ConditionCatalogEntry[] = [
  { id: 'enabled', title: 'Сторона включена' },
  { id: 'no_transaction_in_progress', title: 'Нет активной транзакции' },
  {
    id: 'avg_observed_higher_for_last_steps',
    title: 'Отклонение от средневзвешенной',
    valueUnit: '%',
  },
  { id: 'spread_ok', title: 'Спред в норме', valueUnit: '%' },
  { id: 'transaction_delay_ok', title: 'Задержка между сделками', valueUnit: 'мс' },
  { id: 'balance_ok', title: 'Достаточный баланс' },
  { id: 'stop_loss', title: 'Стоп-лосс', valueUnit: '%' },
  { id: 'trailing_take_profit', title: 'Trailing take-profit', valueUnit: '%' },
  { id: 'max_holding_time', title: 'Макс. время удержания', valueUnit: 'мс' },
  // Legacy / local engine ids (live simulation)
  { id: 'avg_observed_higher_than_buy', title: 'Средняя цена выше цены покупки', valueUnit: '%' },
  {
    id: 'avg_observed_higher_than_buy_for_last_steps',
    title: 'Средняя цена выше покупки за последние N шагов',
    valueUnit: '%',
  },
  { id: 'avg_observed_higher_than_sell', title: 'Средняя цена выше цены продажи', valueUnit: '%' },
  {
    id: 'avg_observed_higher_than_sell_for_last_steps',
    title: 'Средняя цена выше продажи за последние N шагов',
    valueUnit: '%',
  },
  { id: 'last_finished_transaction_delay_ok', title: 'Задержка после завершённой транзакции', valueUnit: 'мс' },
  { id: 'token1_balance_ok', title: 'Достаточный баланс базового актива' },
  { id: 'token2_balance_ok', title: 'Достаточный баланс котировки' },
]

const catalogById = new Map(CONDITIONS_CATALOG.map((entry) => [entry.id, entry]))

export function getCatalogEntry(id: string): ConditionCatalogEntry | undefined {
  return catalogById.get(id)
}

export function getConditionTitle(id: string): string {
  const entry = getCatalogEntry(id)
  if (entry) return entry.title
  return id.replace(/_/g, ' ')
}

export function getConditionValueUnit(id: string): string | undefined {
  return getCatalogEntry(id)?.valueUnit
}

export function formatConditionOutcome(
  id: string,
  current?: string,
  required?: string,
): string | null {
  if (current === undefined && required === undefined) return null
  const unit = getConditionValueUnit(id) ?? ''
  const parts: string[] = []
  if (current !== undefined) parts.push(`факт: ${current}${unit}`)
  if (required !== undefined) parts.push(`порог: ${required}${unit}`)
  return parts.join(' · ')
}
