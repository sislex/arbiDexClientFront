/**
 * Decision Maker — определение BUY / SELL / NONE (автономный модуль).
 *
 * ЗОНА ОТВЕТСТВЕННОСТИ:
 *   - по флагам conditions (evaluations[].passed) и hasPosition
 *   - вернуть торговое решение: "BUY" | "SELL" | "NONE"
 *
 * АВТОНОМНОСТЬ: файл без import. Копируется отдельно.
 *
 * МЕСТО В ПАЙПЛАЙНЕ:
 *   Скрипт №1 (флаги) → Скрипт №3 → этот файл → Скрипт №3 (исполнение)
 *
 * API: resolveBuySellDecision(hasPosition, evaluations) → BuySellDecision
 *
 * ─── ВХОД ───
 *
 * hasPosition: boolean
 *   из StrategyEngineState.hasPosition
 *
 * evaluations: EngineConditionEvaluation[]
 *
 *   EngineConditionEvaluation {
 *     id: string
 *     group: "toBuy" | "toSell"
 *     passed: boolean
 *     current?: string
 *     required?: string
 *   }
 *
 * ─── ВЫХОД ───
 *
 * BuySellDecision = "BUY" | "SELL" | "NONE"
 *
 * Логика:
 *   hasPosition = false → все group "toBuy" passed → BUY, иначе NONE
 *   hasPosition = true  → все group "toSell" passed → SELL, иначе NONE
 *
 * В UI/event action "NONE" отображается как WAIT (маппинг в Скрипте №3).
 *
 * ─── ЗАПУСК ───
 *
 *   import { resolveBuySellDecision } from './resolveBuySellDecision';
 *
 * ЛОКАЛЬНО (demo-decision.ts):
 *
 *   const decision = resolveBuySellDecision(false, [
 *     { id: 'enabled', group: 'toBuy', passed: true },
 *     { id: 'spread_ok', group: 'toBuy', passed: true },
 *   ]);
 *   console.log(decision); // "BUY"
 *
 *   npx tsx demo-decision.ts
 *
 * ─── ПРИМЕРЫ ТЕСТОВЫХ ДАННЫХ ───
 *
 *   const TEST_EVALS_BUY_OK: EngineConditionEvaluation[] = [
 *     { id: 'enabled', group: 'toBuy', passed: true },
 *     { id: 'spread_ok', group: 'toBuy', passed: true },
 *   ];
 *
 *   const TEST_EVALS_BUY_FAIL: EngineConditionEvaluation[] = [
 *     { id: 'enabled', group: 'toBuy', passed: true },
 *     { id: 'spread_ok', group: 'toBuy', passed: false },
 *   ];
 *
 *   const TEST_EVALS_SELL_OK: EngineConditionEvaluation[] = [
 *     { id: 'enabled', group: 'toSell', passed: true },
 *     { id: 'spread_ok', group: 'toSell', passed: true },
 *   ];
 *
 * Пример теста (Vitest):
 *
 *   describe('resolveBuySellDecision', () => {
 *     it('BUY без позиции при всех toBuy passed', () => {
 *       expect(resolveBuySellDecision(false, TEST_EVALS_BUY_OK)).toBe('BUY');
 *     });
 *
 *     it('NONE без позиции при failed toBuy', () => {
 *       expect(resolveBuySellDecision(false, TEST_EVALS_BUY_FAIL)).toBe('NONE');
 *     });
 *
 *     it('SELL в позиции при всех toSell passed', () => {
 *       expect(resolveBuySellDecision(true, TEST_EVALS_SELL_OK)).toBe('SELL');
 *     });
 *   });
 */

export interface EngineConditionEvaluation {
  id: string;
  group: "toBuy" | "toSell";
  passed: boolean;
  current?: string;
  required?: string;
}

export type BuySellDecision = "BUY" | "SELL" | "NONE";

export function resolveBuySellDecision(
  hasPosition: boolean,
  evaluations: EngineConditionEvaluation[],
): BuySellDecision {
  if (!hasPosition) {
    const buyEvals = evaluations.filter(e => e.group === "toBuy");
    if (buyEvals.length > 0 && buyEvals.every(e => e.passed)) return "BUY";
    return "NONE";
  }

  const sellEvals = evaluations.filter(e => e.group === "toSell");
  if (sellEvals.length > 0 && sellEvals.every(e => e.passed)) return "SELL";
  return "NONE";
}
