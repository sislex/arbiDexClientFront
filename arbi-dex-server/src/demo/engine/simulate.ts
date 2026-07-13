import {
  BacktestResult,
  BacktestStats,
  QuotePoint,
  StrategyConditionValue,
  StrategyConfigData,
  Trade,
} from './types';

function num(side: StrategyConditionValue[], conditionId: string, key: string, fallback: number): number {
  const c = side.find((x) => x.conditionId === conditionId);
  if (!c || !c.enabled) return fallback;
  const v = c.params[key];
  return typeof v === 'number' ? v : fallback;
}

function enabled(side: StrategyConditionValue[], conditionId: string): boolean {
  const c = side.find((x) => x.conditionId === conditionId);
  return !!c && c.enabled;
}

export interface SimulateOptions {
  initialBalance?: number;
  id?: string;
}

/**
 * Lightweight backtest simulator over a quote series. Buy when the trading
 * price sits below the observed average by a threshold (sustained N steps),
 * sell when above; sell triggers (stop-loss / trailing TP / max holding) force
 * an exit. Identical logic to the frontend prototype for consistency.
 */
export function simulateBacktest(
  quotes: QuotePoint[],
  strategy: StrategyConfigData,
  opts: SimulateOptions = {},
): BacktestResult {
  const initialBalance = opts.initialBalance ?? 1000;

  const buyPct = num(strategy.buy, 'avg_observed_higher_for_last_steps', 'percent', 0.5);
  const buySteps = Math.max(1, Math.round(num(strategy.buy, 'avg_observed_higher_for_last_steps', 'steps', 3)));
  const sellPct = num(strategy.sell, 'avg_observed_higher_for_last_steps', 'percent', 0.5);
  const sellSteps = Math.max(1, Math.round(num(strategy.sell, 'avg_observed_higher_for_last_steps', 'steps', 3)));
  const maxSpread = num(strategy.buy, 'spread_ok', 'maxSpreadPercent', 100);

  const stopLoss = enabled(strategy.sell, 'stop_loss')
    ? num(strategy.sell, 'stop_loss', 'stopLossPercent', 0)
    : null;
  const trailingTP = enabled(strategy.sell, 'trailing_take_profit')
    ? num(strategy.sell, 'trailing_take_profit', 'trailingTakeProfitPercent', 0)
    : null;
  const maxHoldMs = enabled(strategy.sell, 'max_holding_time')
    ? num(strategy.sell, 'max_holding_time', 'maxHoldingTimeMs', 0)
    : null;

  let cash = initialBalance;
  let tokens = 0;
  let entryPrice = 0;
  let entryCash = 0;
  let openedAt = 0;
  let peak = 0;
  let buyStreak = 0;
  let sellStreak = 0;

  const trades: Trade[] = [];
  let wins = 0;
  let equityPeak = initialBalance;
  let maxDrawdown = 0;

  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    const spread = ((q.buyQuote - q.sellQuote) / q.avgObservedQuote) * 100;
    const spreadOk = spread <= maxSpread;

    const equity = cash + tokens * q.sellQuote;
    if (equity > equityPeak) equityPeak = equity;
    const dd = ((equityPeak - equity) / equityPeak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;

    const belowPct = ((q.avgObservedQuote - q.buyQuote) / q.avgObservedQuote) * 100;
    const abovePct = ((q.sellQuote - q.avgObservedQuote) / q.avgObservedQuote) * 100;

    buyStreak = belowPct >= buyPct ? buyStreak + 1 : 0;
    sellStreak = abovePct >= sellPct ? sellStreak + 1 : 0;

    if (tokens === 0) {
      if (spreadOk && buyStreak >= buySteps) {
        tokens = cash / q.buyQuote;
        entryPrice = q.buyQuote;
        entryCash = cash;
        openedAt = q.time;
        peak = q.sellQuote;
        cash = 0;
        buyStreak = 0;
        trades.push({ id: `t${trades.length}`, time: q.time, side: 'buy', price: q.buyQuote, amount: tokens });
      }
    } else {
      if (q.sellQuote > peak) peak = q.sellQuote;
      let reason: string | undefined;
      if (stopLoss != null && ((entryPrice - q.sellQuote) / entryPrice) * 100 >= stopLoss) reason = 'stop_loss';
      else if (trailingTP != null && ((peak - q.sellQuote) / peak) * 100 >= trailingTP) reason = 'trailing_take_profit';
      else if (maxHoldMs != null && (q.time - openedAt) * 1000 >= maxHoldMs) reason = 'max_holding_time';

      const gateSell = spreadOk && sellStreak >= sellSteps;
      if (reason || gateSell) {
        const proceeds = tokens * q.sellQuote;
        const pnl = proceeds - entryCash;
        if (pnl > 0) wins++;
        cash = proceeds;
        trades.push({
          id: `t${trades.length}`,
          time: q.time,
          side: 'sell',
          price: q.sellQuote,
          amount: tokens,
          pnl: round(pnl),
          reason,
        });
        tokens = 0;
        sellStreak = 0;
      }
    }
  }

  if (tokens > 0 && quotes.length) {
    const last = quotes[quotes.length - 1];
    const proceeds = tokens * last.sellQuote;
    const pnl = proceeds - entryCash;
    if (pnl > 0) wins++;
    cash = proceeds;
    trades.push({
      id: `t${trades.length}`,
      time: last.time,
      side: 'sell',
      price: last.sellQuote,
      amount: tokens,
      pnl: round(pnl),
      reason: 'close_at_end',
    });
    tokens = 0;
  }

  const finalBalance = cash;
  const roundTrips = trades.filter((t) => t.side === 'sell').length;
  const stats: BacktestStats = {
    trades: trades.length,
    pnl: round(finalBalance - initialBalance),
    pnlPct: round(((finalBalance - initialBalance) / initialBalance) * 100),
    winRate: roundTrips ? round((wins / roundTrips) * 100) : 0,
    maxDrawdownPct: round(maxDrawdown),
    finalBalance: round(finalBalance),
  };

  return {
    id: opts.id ?? 'bt',
    from: quotes[0]?.time ?? 0,
    to: quotes[quotes.length - 1]?.time ?? 0,
    quotes,
    trades,
    stats,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
