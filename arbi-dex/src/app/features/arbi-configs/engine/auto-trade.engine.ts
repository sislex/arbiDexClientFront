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

/**
 * Движок автоматической торговли.
 * Чистый класс без DI — используется как обычный объект в компоненте.
 *
 * Логика:
 * — Нет позиции + autoBuyThresholdPct задан → buy если tradingAsk ≤ avgRefMid × (1 − threshold/100)
 * — Есть позиция:
 *   1. Stop-loss: tradingBid ≤ buyPrice × (1 − stopLossPct/100)
 *   2. Trailing take-profit: peakSellPrice отслеживает максимум tradingBid;
 *      trailingSellLevel = peakSellPrice × (1 − trailingPct/100) — монотонно растёт;
 *      если tradingBid ≤ trailingSellLevel → sell
 *   3. Арбитраж-продажа: tradingBid ≥ avgRefMid × (1 + autoSellThresholdPct/100)
 */
export class AutoTradeEngine {
  private _hasPosition = false;
  private _buyPrice = 0;
  private _peakSellPrice = 0;
  private _trailingSellLevel = 0;

  private readonly cfg: AutoTradeConfig;

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
  }

  get hasPosition(): boolean { return this._hasPosition; }
  get buyPrice(): number { return this._buyPrice; }
  get peakSellPrice(): number { return this._peakSellPrice; }
  get trailingSellLevel(): number { return this._trailingSellLevel; }

  /** Стоп-лосс уровень (или 0 если отключён) */
  get stopLossLevel(): number {
    if (!this._hasPosition || this.cfg.stopLossPct == null) return 0;
    return this._buyPrice * (1 - this.cfg.stopLossPct / 100);
  }

  /** Уровень автопокупки при текущей avgRefMid (или 0 если нет позиции не нужна) */
  getAutoBuyLevel(avgRefMid: number): number {
    if (this._hasPosition || this.cfg.autoBuyThresholdPct == null || avgRefMid <= 0) return 0;
    return avgRefMid * (1 - this.cfg.autoBuyThresholdPct / 100);
  }

  /**
   * Вызывается на каждом тике (playback или live).
   * @param tradingBid — цена продажи (bid) на торгуемом источнике
   * @param tradingAsk — цена покупки (ask) на торгуемом источнике
   * @param avgRefMid — средняя mid всех reference-источников
   */
  tick(tradingBid: number, tradingAsk: number, avgRefMid: number): AutoTradeTickResult {
    if (tradingBid <= 0 || tradingAsk <= 0 || avgRefMid <= 0) {
      return { action: 'none' };
    }

    if (this._hasPosition) {
      return this.tickWithPosition(tradingBid, avgRefMid);
    } else {
      return this.tickWithoutPosition(tradingAsk, avgRefMid);
    }
  }

  /** Вызывается извне после успешной покупки */
  onBuy(buyPrice: number): void {
    this._hasPosition = true;
    this._buyPrice = buyPrice;
    this._peakSellPrice = 0;
    this._trailingSellLevel = 0;
  }

  /** Вызывается извне после успешной продажи */
  onSell(): void {
    this._hasPosition = false;
    this._buyPrice = 0;
    this._peakSellPrice = 0;
    this._trailingSellLevel = 0;
  }

  /** Сброс состояния */
  reset(): void {
    this._hasPosition = false;
    this._buyPrice = 0;
    this._peakSellPrice = 0;
    this._trailingSellLevel = 0;
  }

  /* ── Private ── */

  private tickWithPosition(tradingBid: number, avgRefMid: number): AutoTradeTickResult {
    // 1. Stop-loss (наивысший приоритет)
    if (this.cfg.stopLossPct != null) {
      const stopLevel = this._buyPrice * (1 - this.cfg.stopLossPct / 100);
      if (tradingBid <= stopLevel) {
        return { action: 'sell', reason: `Stop-loss: bid ${tradingBid.toFixed(4)} ≤ ${stopLevel.toFixed(4)}` };
      }
    }

    // 2. Trailing take-profit
    if (this.cfg.trailingTakeProfitPct != null) {
      // Обновляем пик — монотонно вверх
      if (tradingBid > this._peakSellPrice) {
        this._peakSellPrice = tradingBid;
      }

      // Рассчитываем trailing уровень — тоже монотонно вверх
      const newTrailingLevel = this._peakSellPrice * (1 - this.cfg.trailingTakeProfitPct / 100);
      if (newTrailingLevel > this._trailingSellLevel) {
        this._trailingSellLevel = newTrailingLevel;
      }

      // Проверяем: цена откатилась до trailing уровня
      if (this._trailingSellLevel > 0 && tradingBid <= this._trailingSellLevel) {
        return {
          action: 'sell',
          reason: `Trailing TP: bid ${tradingBid.toFixed(4)} ≤ trail ${this._trailingSellLevel.toFixed(4)} (peak ${this._peakSellPrice.toFixed(4)})`,
        };
      }
    }

    // 3. Арбитраж-продажа: цена на торгуемом значительно выше средней reference
    if (this.cfg.autoSellThresholdPct != null) {
      const sellLevel = avgRefMid * (1 + this.cfg.autoSellThresholdPct / 100);
      if (tradingBid >= sellLevel) {
        return {
          action: 'sell',
          reason: `Arb sell: bid ${tradingBid.toFixed(4)} ≥ avgRef×(1+${this.cfg.autoSellThresholdPct}%) = ${sellLevel.toFixed(4)}`,
        };
      }
    }

    return { action: 'none' };
  }

  private tickWithoutPosition(tradingAsk: number, avgRefMid: number): AutoTradeTickResult {
    // Автопокупка: цена покупки на торгуемом значительно ниже средней reference
    if (this.cfg.autoBuyThresholdPct != null) {
      const buyLevel = avgRefMid * (1 - this.cfg.autoBuyThresholdPct / 100);
      if (tradingAsk <= buyLevel) {
        return {
          action: 'buy',
          reason: `Auto-buy: ask ${tradingAsk.toFixed(4)} ≤ avgRef×(1-${this.cfg.autoBuyThresholdPct}%) = ${buyLevel.toFixed(4)}`,
        };
      }
    }

    return { action: 'none' };
  }
}

