/** Референсный источник внутри арбитражного конфига */
export interface ArbiConfigSourceRef {
  id: string;
  subscriptionId: string;
  /** Подтянутые данные подписки (если есть) */
  sourceId?: string;
  pairId?: string;
}

/** Арбитражный конфиг */
export interface ArbiConfig {
  id: string;
  name: string;
  tradingSubscriptionId: string;
  /** Подтянутые данные торговой подписки */
  tradingSourceId?: string;
  tradingPairId?: string;
  referenceSubscriptionIds: string[];
  sources: ArbiConfigSourceRef[];
  profitAsset: string;
  slippage: number;
  initialBalance: number;
  /** Порог автопокупки: на сколько % цена торгуемого ниже средней reference */
  autoBuyThresholdPct: number | null;
  /** Порог автопродажи: на сколько % цена торгуемого выше средней reference */
  autoSellThresholdPct: number | null;
  /** Trailing take-profit: % отката от максимума цены продажи */
  trailingTakeProfitPct: number | null;
  /** Стоп-лосс: % убытка от цены покупки */
  stopLossPct: number | null;
  /** % от баланса для каждой сделки */
  tradeAmountPct: number;
  createdAt: number;
}

