import { useAppPreferences } from '../context/AppPreferencesContext'

const LABELS: Record<string, string> = {
  'simulator.events': 'Журнал событий',
  'simulator.explain': 'Почему это произошло?',
  'simulator.explainNo': 'Почему этого НЕ произошло?',
  'simulator.rule': 'Правило',
  'simulator.currentValue': 'Текущее значение',
  'simulator.required': 'Требуется',
  'simulator.riskLabel': 'Риск',
  'simulator.tradeSize': 'Размер сделки',
  'simulator.status': 'Статус стратегии',
  'simulator.decision': 'Решение',
  'simulator.condition.enabled': 'Условие включено',
  'simulator.condition.noTransactionInProgress': 'Нет активной транзакции',
  'simulator.condition.avgObservedHigherThanBuy': 'Средняя цена выше цены покупки',
  'simulator.condition.avgObservedHigherThanBuyForLastSteps':
    'Средняя цена выше покупки за последние N шагов',
  'simulator.condition.spreadOk': 'Спред в допустимом диапазоне',
  'simulator.condition.lastFinishedTransactionDelayOk':
    'Выдержана задержка после завершенной транзакции',
  'simulator.condition.avgObservedHigherThanSell': 'Средняя цена выше цены продажи',
  'simulator.condition.avgObservedHigherThanSellForLastSteps':
    'Средняя цена выше продажи за последние N шагов',
}

export function useSimulatorI18n() {
  const { theme } = useAppPreferences()

  const t = (key: string) => LABELS[key] ?? key

  return {
    t,
    theme,
    isDark: theme === 'dark',
  }
}
