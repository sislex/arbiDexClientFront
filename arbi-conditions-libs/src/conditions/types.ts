/**
 * Analytics auto-trading condition types.
 * Mirrors arbi-dex-server/src/arbi-configs/analytics/conditions.config.json,
 * so both frontend and backend share one source of truth.
 */
export type ConditionType =
  | 'OBSERVED_ABOVE_BUY'
  | 'OBSERVED_BELOW_SELL'
  | 'SPREAD_WITHIN';

/** A single analytics condition as stored in conditions.config.json. */
export interface AnalyticsCondition {
  id: string;
  type: ConditionType;
  /** Threshold in percent, where `0.02` means 0.02% (i.e. a 0.0002 fraction). */
  thresholdPct: number;
  enabled: boolean;
  description?: string;
}

/** The full conditions config file shape. */
export interface ConditionsConfig {
  version: number;
  description?: string;
  conditions: AnalyticsCondition[];
}

/** Market values a condition is evaluated against. */
export interface PriceContext {
  /** Observed (average over reference markets) price. */
  observedPrice: number;
  buyPrice: number;
  sellPrice: number;
}
