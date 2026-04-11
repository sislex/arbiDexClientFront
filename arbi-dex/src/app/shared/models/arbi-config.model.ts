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
  createdAt: number;
}

