/**
 * Helper аналитики автоторговли.
 *
 * Чистый, фреймворк-агностичный TypeScript (без NestJS/Angular зависимостей),
 * чтобы его можно было переиспользовать как на бэкенде, так и на фронтенде.
 *
 * Идея: на каждом шаге у нас есть 3 котировки (наблюдаемая средняя по
 * reference-рынкам, цена покупки, цена продажи). Функция `evaluateConditions`
 * прогоняет котировки через набор условий из конфига и возвращает для каждого
 * условия результат — прошло оно или нет.
 *
 * Набор условий расширяемый: новые типы добавляются в `CONDITION_EVALUATORS`.
 */

/** Котировки на конкретном шаге */
export interface StepQuotes {
  /** Наблюдаемая цена — средняя по reference-рынкам, за которыми наблюдаем */
  observedPrice: number;
  /** Цена покупки — ask на рынке, где покупаем */
  buyPrice: number;
  /** Цена продажи — bid на рынке, где продаём */
  sellPrice: number;
}

/** Тип условия. Расширяется при добавлении новых правил. */
export type ConditionType =
  | 'OBSERVED_ABOVE_BUY'
  | 'OBSERVED_BELOW_SELL'
  | 'SPREAD_WITHIN';

/** Описание одного условия из конфига */
export interface ConditionDefinition {
  /** Уникальный идентификатор условия */
  id: string;
  /** Тип условия (определяет формулу проверки) */
  type: ConditionType;
  /** Порог в процентах (0.02 означает 0.02%) */
  thresholdPct: number;
  /** Включено ли условие (по умолчанию true) */
  enabled?: boolean;
  /** Человекочитаемое описание */
  description?: string;
}

/** Конфиг условий аналитики (структура файла conditions.config.json) */
export interface AnalyticsConditionsConfig {
  version?: number;
  description?: string;
  conditions: ConditionDefinition[];
}

/** Результат проверки одного условия */
export interface ConditionResult {
  id: string;
  type: ConditionType;
  /** Прошло ли условие */
  passed: boolean;
  /** Порог из конфига, в процентах */
  thresholdPct: number;
  /** Фактическое значение метрики, в процентах (для прозрачности/отладки) */
  actualPct: number;
  description?: string;
}

/** Действие, выбранное на шаге (определяется по результатам условий + позиции) */
export type StepAction = 'buy' | 'sell' | 'none';

/** Полная аналитика по одному шагу бэктеста */
export interface StepAnalytics {
  time: number;
  index: number;
  quotes: StepQuotes;
  conditions: ConditionResult[];
  action: StepAction;
}

/** Статистика по одному условию за весь прогон */
export interface ConditionStat {
  id: string;
  type: ConditionType;
  thresholdPct: number;
  passedCount: number;
  failedCount: number;
}

/** Сводная аналитика по всему бэктесту (компактная, без массива шагов) */
export interface BacktestAnalyticsSummary {
  /** Всего обработано шагов */
  totalSteps: number;
  /** Сколько раз прошёл сигнал на покупку (OBSERVED_ABOVE_BUY) */
  buySignals: number;
  /** Сколько раз прошёл сигнал на продажу (OBSERVED_BELOW_SELL) */
  sellSignals: number;
  /** Сколько раз транзакция была разрешена (SPREAD_WITHIN) */
  txAllowed: number;
  /** Статистика прохождения по каждому условию */
  conditionStats: ConditionStat[];
}

/** Результат вычисления метрики условия */
export interface EvaluatorOutput {
  passed: boolean;
  /** Фактическое значение метрики в процентах */
  actualPct: number;
}

/** Безопасно ли использовать цену в расчётах */
function isValidPrice(value: number): boolean {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

/**
 * Реестр вычислителей по типу условия.
 * Чтобы добавить новое условие — достаточно добавить запись сюда и тип в ConditionType.
 *
 * thresholdPct передаётся в процентах (0.02 = 0.02%); внутри переводим в долю /100.
 */
export const CONDITION_EVALUATORS: Record<
  ConditionType,
  (quotes: StepQuotes, thresholdPct: number) => EvaluatorOutput
> = {
  /**
   * Покупка: наблюдаемая цена выше цены покупки больше чем на thresholdPct%.
   * metric = (observed - buy) / buy * 100
   */
  OBSERVED_ABOVE_BUY: (q, thresholdPct) => {
    if (!isValidPrice(q.observedPrice) || !isValidPrice(q.buyPrice)) {
      return { passed: false, actualPct: 0 };
    }
    const actualPct = ((q.observedPrice - q.buyPrice) / q.buyPrice) * 100;
    return { passed: actualPct > thresholdPct, actualPct };
  },

  /**
   * Продажа: наблюдаемая цена ниже цены продажи больше чем на thresholdPct%.
   * metric = (sell - observed) / sell * 100
   */
  OBSERVED_BELOW_SELL: (q, thresholdPct) => {
    if (!isValidPrice(q.observedPrice) || !isValidPrice(q.sellPrice)) {
      return { passed: false, actualPct: 0 };
    }
    const actualPct = ((q.sellPrice - q.observedPrice) / q.sellPrice) * 100;
    return { passed: actualPct > thresholdPct, actualPct };
  },

  /**
   * Разрешение транзакции: цены покупки и продажи различаются меньше чем на thresholdPct%.
   * metric = |buy - sell| / ((buy + sell) / 2) * 100
   */
  SPREAD_WITHIN: (q, thresholdPct) => {
    if (!isValidPrice(q.buyPrice) || !isValidPrice(q.sellPrice)) {
      return { passed: false, actualPct: 0 };
    }
    const mid = (q.buyPrice + q.sellPrice) / 2;
    const actualPct = (Math.abs(q.buyPrice - q.sellPrice) / mid) * 100;
    return { passed: actualPct < thresholdPct, actualPct };
  },
};

/**
 * Оценивает все включённые условия конфига для котировок шага.
 * Чистая функция — не мутирует входные данные.
 *
 * @returns массив результатов: для каждого условия указано, прошло оно (`passed: true`)
 *          или нет (`passed: false`).
 */
export function evaluateConditions(
  quotes: StepQuotes,
  config: AnalyticsConditionsConfig,
): ConditionResult[] {
  const results: ConditionResult[] = [];

  for (const def of config.conditions) {
    if (def.enabled === false) continue;

    const evaluator = CONDITION_EVALUATORS[def.type];
    if (!evaluator) {
      // Неизвестный тип условия — считаем непройденным, не падаем.
      results.push({
        id: def.id,
        type: def.type,
        passed: false,
        thresholdPct: def.thresholdPct,
        actualPct: 0,
        description: def.description,
      });
      continue;
    }

    const { passed, actualPct } = evaluator(quotes, def.thresholdPct);
    results.push({
      id: def.id,
      type: def.type,
      passed,
      thresholdPct: def.thresholdPct,
      actualPct,
      description: def.description,
    });
  }

  return results;
}

/** Удобная разбивка результатов на прошедшие и непрошедшие условия */
export function splitConditionResults(results: ConditionResult[]): {
  passed: ConditionResult[];
  failed: ConditionResult[];
} {
  const passed: ConditionResult[] = [];
  const failed: ConditionResult[] = [];
  for (const r of results) {
    (r.passed ? passed : failed).push(r);
  }
  return { passed, failed };
}

/**
 * Выбирает действие на шаге по результатам условий и текущей позиции.
 *
 * Логика (на начальном этапе):
 *  - покупка, если нет позиции, прошёл сигнал на покупку и транзакция разрешена;
 *  - продажа, если есть позиция, прошёл сигнал на продажу и транзакция разрешена.
 *
 * Если условие SPREAD_WITHIN в конфиге отсутствует — транзакция считается разрешённой.
 */
export function decideAction(
  results: ConditionResult[],
  hasPosition: boolean,
): StepAction {
  const passedByType = new Map<ConditionType, boolean>();
  const presentByType = new Set<ConditionType>();
  for (const r of results) {
    presentByType.add(r.type);
    if (r.passed) passedByType.set(r.type, true);
  }

  const buySignal = passedByType.get('OBSERVED_ABOVE_BUY') === true;
  const sellSignal = passedByType.get('OBSERVED_BELOW_SELL') === true;
  const txAllowed = presentByType.has('SPREAD_WITHIN')
    ? passedByType.get('SPREAD_WITHIN') === true
    : true;

  if (!txAllowed) return 'none';
  if (!hasPosition && buySignal) return 'buy';
  if (hasPosition && sellSignal) return 'sell';
  return 'none';
}
