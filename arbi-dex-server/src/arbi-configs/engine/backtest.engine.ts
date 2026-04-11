/**
 * Движок бэктеста автоторговли.
 * Портирован с фронтенда (AutoTradeEngine) + логика исполнения свопов (DemoAccountEffects).
 * Чистый класс без DI — может использоваться в любом контексте.
 */

/** Конфиг бэктеста */
export interface BacktestConfig {
  autoBuyThresholdPct: number | null;
  autoSellThresholdPct: number | null;
  trailingTakeProfitPct: number | null;
  stopLossPct: number | null;
  tradeAmountPct: number;
  slippage: number;
  initialBalance: number;
}

/** Одна точка для бэктеста: time + цены торгового и reference источников */
export interface BacktestTick {
  time: number;
  index: number;
  tradingBid: number;
  tradingAsk: number;
  avgRefMid: number;
}

/** Запись о сделке */
export interface BacktestTrade {
  id: number;
  step: number;
  time: number;
  direction: 'USDC_TO_WETH' | 'WETH_TO_USDC';
  amountIn: number;
  tokenIn: string;
  amountOut: number;
  tokenOut: string;
  price: number;
  slippage: number;
  reason: string;
}

/** Результат бэктеста */
export interface BacktestResult {
  /** Итоговый баланс USDC */
  finalUsdcBalance: number;
  /** Итоговый баланс WETH */
  finalWethBalance: number;
  /** Стоимость портфеля в USDC */
  portfolioValue: number;
  /** Начальный баланс USDC */
  initialBalance: number;
  /** P&L в USDC */
  pnl: number;
  /** P&L в % */
  pnlPct: number;
  /** Общее количество сделок */
  totalTrades: number;
  /** Количество покупок */
  buyCount: number;
  /** Количество продаж */
  sellCount: number;
  /** Количество обработанных точек */
  totalPoints: number;
  /** Список сделок */
  trades: BacktestTrade[];
}

export class BacktestEngine {
  private cfg: BacktestConfig;

  // Состояние баланса
  private usdcBalance: number;
  private wethBalance = 0;

  // Состояние позиции (аналог AutoTradeEngine)
  private hasPosition = false;
  private buyPrice = 0;
  private peakSellPrice = 0;
  private trailingSellLevel = 0;

  // Результаты
  private trades: BacktestTrade[] = [];
  private tradeCounter = 0;

  constructor(cfg: BacktestConfig) {
    this.cfg = { ...cfg };
    this.usdcBalance = Number(cfg.initialBalance);
  }

  /**
   * Прогоняет все тики через движок автоторговли.
   * Возвращает полный результат бэктеста.
   */
  run(ticks: BacktestTick[]): BacktestResult {
    for (const tick of ticks) {
      this.processTick(tick);
    }

    // Вычисляем итоговую стоимость портфеля — используем последнюю цену mid
    const lastTick = ticks.length > 0 ? ticks[ticks.length - 1] : null;
    const lastMid = lastTick
      ? (lastTick.tradingBid > 0 && lastTick.tradingAsk > 0
          ? (lastTick.tradingBid + lastTick.tradingAsk) / 2
          : lastTick.tradingBid || lastTick.tradingAsk)
      : 0;

    const portfolioValue = this.usdcBalance + this.wethBalance * lastMid;
    const pnl = portfolioValue - this.cfg.initialBalance;
    const pnlPct = this.cfg.initialBalance > 0 ? (pnl / this.cfg.initialBalance) * 100 : 0;

    return {
      finalUsdcBalance: parseFloat(this.usdcBalance.toFixed(8)),
      finalWethBalance: parseFloat(this.wethBalance.toFixed(8)),
      portfolioValue: parseFloat(portfolioValue.toFixed(2)),
      initialBalance: Number(this.cfg.initialBalance),
      pnl: parseFloat(pnl.toFixed(2)),
      pnlPct: parseFloat(pnlPct.toFixed(4)),
      totalTrades: this.trades.length,
      buyCount: this.trades.filter((t) => t.direction === 'USDC_TO_WETH').length,
      sellCount: this.trades.filter((t) => t.direction === 'WETH_TO_USDC').length,
      totalPoints: ticks.length,
      trades: [...this.trades].reverse(),
    };
  }

  /* ── Private ── */

  private processTick(tick: BacktestTick): void {
    if (tick.tradingBid <= 0 || tick.tradingAsk <= 0 || tick.avgRefMid <= 0) {
      return;
    }

    if (this.hasPosition) {
      const result = this.tickWithPosition(tick.tradingBid, tick.avgRefMid);
      if (result.action === 'sell' && this.wethBalance > 0) {
        // Продажа по bid (как на реальном рынке)
        const sellPrice = tick.tradingBid;
        this.executeSell(this.wethBalance, sellPrice, tick, result.reason);
      }
    } else {
      const result = this.tickWithoutPosition(tick.tradingAsk, tick.avgRefMid);
      if (result.action === 'buy') {
        const tradeAmountPct = this.cfg.tradeAmountPct ?? 100;
        const amount = this.usdcBalance * (Number(tradeAmountPct) / 100);
        if (amount > 0) {
          // Покупка по ask (как на реальном рынке)
          const buyPrice = tick.tradingAsk;
          this.executeBuy(amount, buyPrice, tick, result.reason);
        }
      }
    }
  }

  /** Исполняет покупку WETH за USDC */
  private executeBuy(amountUsdc: number, price: number, tick: BacktestTick, reason: string): void {
    const slippage = Number(this.cfg.slippage);
    const effectivePrice = price * (1 + slippage);
    const amountOut = amountUsdc / effectivePrice;

    this.usdcBalance -= amountUsdc;
    this.wethBalance += amountOut;

    this.hasPosition = true;
    this.buyPrice = price;
    this.peakSellPrice = 0;
    this.trailingSellLevel = 0;

    this.trades.push({
      id: ++this.tradeCounter,
      step: tick.index,
      time: tick.time,
      direction: 'USDC_TO_WETH',
      amountIn: parseFloat(amountUsdc.toFixed(8)),
      tokenIn: 'USDC',
      amountOut: parseFloat(amountOut.toFixed(8)),
      tokenOut: 'WETH',
      price,
      slippage,
      reason,
    });
  }

  /** Исполняет продажу WETH за USDC */
  private executeSell(amountWeth: number, price: number, tick: BacktestTick, reason: string): void {
    const slippage = Number(this.cfg.slippage);
    const effectivePrice = price * (1 - slippage);
    const amountOut = amountWeth * effectivePrice;

    this.wethBalance -= amountWeth;
    this.usdcBalance += amountOut;

    this.hasPosition = false;
    this.buyPrice = 0;
    this.peakSellPrice = 0;
    this.trailingSellLevel = 0;

    this.trades.push({
      id: ++this.tradeCounter,
      step: tick.index,
      time: tick.time,
      direction: 'WETH_TO_USDC',
      amountIn: parseFloat(amountWeth.toFixed(8)),
      tokenIn: 'WETH',
      amountOut: parseFloat(amountOut.toFixed(8)),
      tokenOut: 'USDC',
      price,
      slippage,
      reason,
    });
  }

  /* ── Логика автоторговли (порт с AutoTradeEngine) ── */

  private tickWithPosition(tradingBid: number, avgRefMid: number): { action: 'sell' | 'none'; reason: string } {
    // 1. Stop-loss
    if (this.cfg.stopLossPct != null) {
      const stopLevel = this.buyPrice * (1 - Number(this.cfg.stopLossPct) / 100);
      if (tradingBid <= stopLevel) {
        return { action: 'sell', reason: `Stop-loss: bid ${tradingBid.toFixed(4)} ≤ ${stopLevel.toFixed(4)}` };
      }
    }

    // 2. Trailing take-profit
    if (this.cfg.trailingTakeProfitPct != null) {
      if (tradingBid > this.peakSellPrice) {
        this.peakSellPrice = tradingBid;
      }
      const newTrailingLevel = this.peakSellPrice * (1 - Number(this.cfg.trailingTakeProfitPct) / 100);
      if (newTrailingLevel > this.trailingSellLevel) {
        this.trailingSellLevel = newTrailingLevel;
      }
      if (this.trailingSellLevel > 0 && tradingBid <= this.trailingSellLevel) {
        return {
          action: 'sell',
          reason: `Trailing TP: bid ${tradingBid.toFixed(4)} ≤ trail ${this.trailingSellLevel.toFixed(4)} (peak ${this.peakSellPrice.toFixed(4)})`,
        };
      }
    }

    // 3. Арбитраж-продажа
    if (this.cfg.autoSellThresholdPct != null) {
      const sellLevel = avgRefMid * (1 + Number(this.cfg.autoSellThresholdPct) / 100);
      if (tradingBid >= sellLevel) {
        return {
          action: 'sell',
          reason: `Arb sell: bid ${tradingBid.toFixed(4)} ≥ avgRef×(1+${this.cfg.autoSellThresholdPct}%) = ${sellLevel.toFixed(4)}`,
        };
      }
    }

    return { action: 'none', reason: '' };
  }

  private tickWithoutPosition(tradingAsk: number, avgRefMid: number): { action: 'buy' | 'none'; reason: string } {
    if (this.cfg.autoBuyThresholdPct != null) {
      const buyLevel = avgRefMid * (1 - Number(this.cfg.autoBuyThresholdPct) / 100);
      if (tradingAsk <= buyLevel) {
        return {
          action: 'buy',
          reason: `Auto-buy: ask ${tradingAsk.toFixed(4)} ≤ avgRef×(1-${this.cfg.autoBuyThresholdPct}%) = ${buyLevel.toFixed(4)}`,
        };
      }
    }
    return { action: 'none', reason: '' };
  }
}

