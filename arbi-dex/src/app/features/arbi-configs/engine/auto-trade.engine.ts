import {
  processStep,
  prepareSteps,
  TRIGGER_CONDITIONS,
} from '@sislex/arbi-conditions-libs';
import type {
  ConditionDef,
  MarketStep,
  PositionState,
  StrategyEngineConfig,
  TradingConditionsStepResult,
} from '@sislex/arbi-conditions-libs';
import { ArbiConfig } from '../../../shared/models';

export type AutoTradeAction = 'buy' | 'sell' | 'none';

export interface AutoTradeTickResult {
  action: AutoTradeAction;
  reason?: string;
}

export interface AutoTradeConfig {
  autoBuyThresholdPct: number | null;
  autoSellThresholdPct: number | null;
  trailingTakeProfitPct: number | null;
  stopLossPct: number | null;
  tradeAmountPct: number;
  slippage: number;
}

/** Coerce a possibly-string / null value to number | null. */
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || (v as unknown) === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Permissive base strategy — the engine's built-in gates never block; the real
 * buy/sell logic lives in the custom gate conditions (below). Only the sell
 * TRIGGER fields (stop-loss / trailing) are meaningful here. Mirrors the server
 * `strategy-config.mapper`, so FE / BE / lib share one strategy definition.
 */
function buildStrategy(cfg: AutoTradeConfig): StrategyEngineConfig {
  return {
    buy: {
      enabled: true,
      requireNoTransactionInProgress: false,
      avgObservedHigherThanBuyForLastSteps: { steps: 1, percent: 0 },
      maxBuySellSpreadPercent: Number.POSITIVE_INFINITY,
      minDelayAfterLastFinishedTransactionMs: 0,
      requireToken1Balance: false,
      minToken1Balance: 0,
    },
    sell: {
      enabled: true,
      requireNoTransactionInProgress: false,
      avgObservedHigherThanSellForLastSteps: { steps: 1, percent: 0 },
      maxBuySellSpreadPercent: Number.POSITIVE_INFINITY,
      minDelayAfterLastFinishedTransactionMs: 0,
      requireToken2Balance: false,
      minToken2Balance: 0,
      stopLossPercent: num(cfg.stopLossPct),
      trailingTakeProfitPercent: num(cfg.trailingTakeProfitPct),
      maxHoldingTimeMs: null,
    },
  };
}

/**
 * Custom GATE conditions matching the server exactly:
 *   auto_buy:  ask ≤ avg·(1 − autoBuyThresholdPct/100)   (buy side; neutral on sell)
 *   auto_sell: bid ≥ avg·(1 + autoSellThresholdPct/100)  (sell side; neutral on buy)
 */
function buildGates(cfg: AutoTradeConfig): ConditionDef[] {
  const buyPct = num(cfg.autoBuyThresholdPct);
  const sellPct = num(cfg.autoSellThresholdPct);

  const autoBuy: ConditionDef = {
    id: 'auto_buy',
    window: () => ({}),
    evaluate: (ctx, _s, side) => {
      if (side !== 'buy') return { passed: true };
      if (buyPct === null) return { passed: false };
      const avg = ctx.current.quotes.avgObservedQuote;
      const ask = ctx.current.quotes.buyQuote;
      const buyLevel = avg * (1 - buyPct / 100);
      return { passed: avg > 0 && ask > 0 && ask <= buyLevel, actual: ask, required: buyLevel };
    },
  };

  const autoSell: ConditionDef = {
    id: 'auto_sell',
    window: () => ({}),
    evaluate: (ctx, _s, side) => {
      if (side !== 'sell') return { passed: true };
      if (sellPct === null) return { passed: false };
      const avg = ctx.current.quotes.avgObservedQuote;
      const bid = ctx.current.quotes.sellQuote;
      const sellLevel = avg * (1 + sellPct / 100);
      return { passed: avg > 0 && bid > 0 && bid >= sellLevel, actual: bid, required: sellLevel };
    },
  };

  return [autoBuy, autoSell];
}

/**
 * Движок автоматической торговли.
 *
 * Тонкая обёртка над общим движком стратегии (`processStep` из
 * `@sislex/arbi-conditions-libs`): решение buy/sell принимает библиотека —
 * единый источник правды для фронта, сервера и бэктеста. Класс сохраняет
 * прежний публичный API (tick / onBuy / onSell / reset + геттеры уровней),
 * поэтому компонент не меняется. Уровни для отрисовки линий (buyPrice,
 * stopLossLevel, trailingSellLevel, peakSellPrice, getAutoBuyLevel) считаются
 * локально из позиции и порогов конфига.
 */
export class AutoTradeEngine {
  private readonly cfg: AutoTradeConfig;
  private readonly strategy: StrategyEngineConfig;
  private readonly gates: ConditionDef[];
  private readonly triggers: ConditionDef[] = TRIGGER_CONDITIONS;

  /** Окно шагов (синтетическое время); prepareSteps держит его минимальным. */
  private window: MarketStep[] = [];
  private position: PositionState | null = null;
  private clock = 0;
  /** Пик bid с момента входа (для трейлинга и линии Peak). */
  private peak = 0;

  constructor(config: Pick<ArbiConfig,
    'autoBuyThresholdPct' | 'autoSellThresholdPct' |
    'trailingTakeProfitPct' | 'stopLossPct' |
    'tradeAmountPct' | 'slippage'
  >) {
    this.cfg = {
      autoBuyThresholdPct: config.autoBuyThresholdPct,
      autoSellThresholdPct: config.autoSellThresholdPct,
      trailingTakeProfitPct: config.trailingTakeProfitPct,
      stopLossPct: config.stopLossPct,
      tradeAmountPct: config.tradeAmountPct,
      slippage: config.slippage,
    };
    this.strategy = buildStrategy(this.cfg);
    this.gates = buildGates(this.cfg);
  }

  get hasPosition(): boolean { return this.position !== null; }
  get buyPrice(): number { return this.position?.entryPrice ?? 0; }
  get peakSellPrice(): number { return this.peak; }

  /** Trailing-уровень: peak × (1 − trailingPct/100), 0 если нет позиции/порога. */
  get trailingSellLevel(): number {
    const pct = num(this.cfg.trailingTakeProfitPct);
    if (this.position === null || pct === null || this.peak <= 0) return 0;
    return this.peak * (1 - pct / 100);
  }

  /** Стоп-лосс уровень (или 0 если отключён). */
  get stopLossLevel(): number {
    const pct = num(this.cfg.stopLossPct);
    if (this.position === null || pct === null) return 0;
    return this.position.entryPrice * (1 - pct / 100);
  }

  /** Уровень автопокупки при текущей avgRefMid (или 0 если позиция открыта/порог не задан). */
  getAutoBuyLevel(avgRefMid: number): number {
    const pct = num(this.cfg.autoBuyThresholdPct);
    if (this.position !== null || pct === null || avgRefMid <= 0) return 0;
    return avgRefMid * (1 - pct / 100);
  }

  /**
   * Вызывается на каждом тике (playback или live). Решение принимает общий движок.
   * @param tradingBid — цена продажи (bid) на торгуемом источнике
   * @param tradingAsk — цена покупки (ask) на торгуемом источнике
   * @param avgRefMid — средняя mid всех reference-источников
   */
  tick(tradingBid: number, tradingAsk: number, avgRefMid: number): AutoTradeTickResult {
    if (tradingBid <= 0 || tradingAsk <= 0 || avgRefMid <= 0) {
      return { action: 'none' };
    }

    this.clock += 1;
    this.window.push({
      time: this.clock,
      quotes: { buyQuote: tradingAsk, sellQuote: tradingBid, avgObservedQuote: avgRefMid },
    });

    // Пик отслеживаем только в позиции (bid строго после входа).
    if (this.position !== null && tradingBid > this.peak) {
      this.peak = tradingBid;
    }

    // Тримминг окна до минимально необходимого lookback (в т.ч. до момента входа).
    const prepared = prepareSteps({
      steps: this.window,
      strategy: this.strategy,
      position: this.position,
      conditions: this.gates,
      triggerConditions: this.triggers,
    });
    this.window = prepared.steps;

    const result = processStep(prepared);

    if (this.position === null) {
      if (result.transaction.buy) {
        return { action: 'buy', reason: this.buyReason(tradingAsk, avgRefMid) };
      }
    } else if (result.transaction.sell || result.transaction.forcedSell) {
      return { action: 'sell', reason: this.sellReason(result, tradingBid, avgRefMid) };
    }

    return { action: 'none' };
  }

  /** Вызывается извне после успешной покупки. */
  onBuy(buyPrice: number): void {
    this.position = { entryPrice: buyPrice, size: 0, openedAt: this.clock };
    this.peak = 0;
  }

  /** Вызывается извне после успешной продажи. */
  onSell(): void {
    this.position = null;
    this.peak = 0;
  }

  /** Сброс состояния. */
  reset(): void {
    this.position = null;
    this.peak = 0;
    this.window = [];
    this.clock = 0;
  }

  /* ── Reason strings (приоритет как в прежнем движке: stop → trailing → arb) ── */

  private buyReason(ask: number, avgRefMid: number): string {
    const pct = num(this.cfg.autoBuyThresholdPct) ?? 0;
    const level = avgRefMid * (1 - pct / 100);
    return `Auto-buy: ask ${ask.toFixed(4)} ≤ avgRef×(1-${pct}%) = ${level.toFixed(4)}`;
  }

  private sellReason(result: TradingConditionsStepResult, bid: number, avgRefMid: number): string {
    if (result.condition.sell['stop_loss']?.passed) {
      return `Stop-loss: bid ${bid.toFixed(4)} ≤ ${this.stopLossLevel.toFixed(4)}`;
    }
    if (result.condition.sell['trailing_take_profit']?.passed) {
      return `Trailing TP: bid ${bid.toFixed(4)} ≤ trail ${this.trailingSellLevel.toFixed(4)} (peak ${this.peak.toFixed(4)})`;
    }
    const pct = num(this.cfg.autoSellThresholdPct) ?? 0;
    const level = avgRefMid * (1 + pct / 100);
    return `Arb sell: bid ${bid.toFixed(4)} ≥ avgRef×(1+${pct}%) = ${level.toFixed(4)}`;
  }
}
