type TranslateFn = (key: string) => string;

export function getConditionLabel(
  t: TranslateFn | undefined,
  id: string,
  token1Label: string,
  token2Label: string,
): string {
  const localized = (key: string, fallback: string) => {
    if (!t) return fallback;
    const value = t(key);
    return value === key ? fallback : value;
  };
  const localizedWithToken = (key: string, fallback: string, token: string) =>
    localized(key, fallback).replace(/\{token\}/g, token);

  const byId: Record<string, string> = {
    enabled: localized("simulator.condition.enabled", "Условие включено"),
    no_transaction_in_progress: localized(
      "simulator.condition.noTransactionInProgress",
      "Нет активной транзакции",
    ),
    avg_observed_higher_than_buy: localized(
      "simulator.condition.avgObservedHigherThanBuy",
      "Средняя цена выше цены покупки",
    ),
    avg_observed_higher_than_buy_for_last_steps: localized(
      "simulator.condition.avgObservedHigherThanBuyForLastSteps",
      "Средняя цена выше покупки за последние N шагов",
    ),
    spread_ok: localized("simulator.condition.spreadOk", "Спред в допустимом диапазоне"),
    last_finished_transaction_delay_ok: localized(
      "simulator.condition.lastFinishedTransactionDelayOk",
      "Выдержана задержка после завершенной транзакции",
    ),
    token1_balance_ok: localizedWithToken(
      "simulator.condition.token1BalanceOk",
      `Достаточный баланс ${token1Label}`,
      token1Label,
    ),
    avg_observed_higher_than_sell: localized(
      "simulator.condition.avgObservedHigherThanSell",
      "Средняя цена выше цены продажи",
    ),
    avg_observed_higher_than_sell_for_last_steps: localized(
      "simulator.condition.avgObservedHigherThanSellForLastSteps",
      "Средняя цена выше продажи за последние N шагов",
    ),
    token2_balance_ok: localizedWithToken(
      "simulator.condition.token2BalanceOk",
      `Достаточный баланс ${token2Label}`,
      token2Label,
    ),
  };
  return byId[id] ?? id;
}
