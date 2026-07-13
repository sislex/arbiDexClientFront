/**
 * Live integration smoke: exercises the REAL live API client against a running
 * arbi-dex-server. Run with the backend up:
 *   VITE_API_BASE_URL=http://localhost:3006/api npx vite-node scripts/live-smoke.ts
 */
import { api } from '../src/api';
import { IS_LIVE } from '../src/api/config';
import { defaultStrategySides } from '../src/domain/conditionsCatalog';
import type { Bot } from '../src/domain/types';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ✓ ' + msg);
}

async function main() {
  assert(IS_LIVE, 'live mode enabled (VITE_API_BASE_URL set)');

  console.log('[auth]');
  const user = await api.auth.connectWallet();
  assert(user.token && user.address, `logged in as ${user.address}`);

  console.log('[catalog]');
  const markets = await api.catalog.markets();
  // Count is environment-derived (live market-data keys), so assert structure, not a fixed number.
  assert(markets.length > 0, `markets = ${markets.length}`);
  const dex = markets.find((m) => m.kind === 'dex');
  // Prefer observed CEX markets that share the trading market's base asset (a
  // meaningful reference); otherwise fall back to any two CEX markets.
  const sameBase = markets.filter((m) => m.kind === 'cex' && dex && m.base === dex.base);
  const cexes = (sameBase.length ? sameBase : markets.filter((m) => m.kind === 'cex')).slice(0, 2);

  console.log('[market-configs]');
  const mc = await api.marketConfigs.create({
    name: 'Smoke ETH',
    tradingMarketId: dex!.id,
    observedMarketIds: cexes.map((m) => m.id),
    useWeightedAverage: true,
    weights: {},
  });
  assert(!!mc.id, `created market-config ${mc.id}`);
  assert(typeof mc.createdAt === 'string', 'createdAt is ISO string');
  const mcList = await api.marketConfigs.list();
  assert(mcList.some((m) => m.id === mc.id), 'market-config appears in list');
  const quotes = await api.quotes.series({ marketConfigId: mc.id, count: 120 });
  assert(quotes.length === 120, `quotes series = ${quotes.length} points`);
  assert(typeof quotes[0].buyQuote === 'number', 'quote has buyQuote');

  console.log('[strategy-configs]');
  const sides = defaultStrategySides();
  const st = await api.strategyConfigs.create({ name: 'Smoke strat', buy: sides.buy, sell: sides.sell });
  assert(st.buy.length > 0 && st.sell.length > 0, 'created strategy with buy/sell conditions');

  console.log('[bots + demo account]');
  const botInput: Omit<Bot, 'id' | 'createdAt' | 'updatedAt'> = {
    name: 'Smoke bot',
    status: 'stopped',
    mode: 'demo-live',
    marketConfigId: mc.id,
    strategyConfigId: st.id,
    baseAsset: dex!.base,
    quoteAsset: dex!.quote,
    initialBalance: 1000,
    balance: 1000,
    pnl: 0,
    pnlPct: 0,
    tradesCount: 0,
    winRate: 0,
    openPosition: false,
  };
  const bot = await api.bots.create(botInput);
  assert(bot.balance === 1000, `created bot ${bot.id} balance=1000`);

  console.log('[history range + backtest → demo account update]');
  const range = await api.bots.historyRange(bot.id);
  assert(range.historyTo >= range.historyFrom, `history range ${range.historyFrom}..${range.historyTo}`);

  // Default period (last week of history); server clamps to available data.
  // NOTE: on real market data the strategy may legitimately make zero trades, so
  // we assert the backtest RAN correctly (window + consistent stats), not trades>0.
  const bt = await api.backtest.run({ strategyConfigId: st.id, marketConfigId: mc.id, botId: bot.id });
  assert(bt.quotes.length > 0, `backtest quotes = ${bt.quotes.length}`);
  assert(bt.trades.length === bt.stats.trades, `trades match stats (${bt.trades.length})`);
  assert(typeof bt.stats.finalBalance === 'number', `finalBalance = ${bt.stats.finalBalance}`);
  const refreshed = await api.bots.get(bot.id);
  assert(refreshed!.tradesCount === bt.stats.trades, `bot tradesCount = ${refreshed!.tradesCount}`);
  assert(Math.abs(refreshed!.balance - bt.stats.finalBalance) < 0.01, 'demo account balance == backtest finalBalance');

  // Custom sub-window: run over the second half of history and confirm it is honoured.
  const mid = Math.round((range.historyFrom + range.historyTo) / 2);
  const btHalf = await api.backtest.run({ strategyConfigId: st.id, marketConfigId: mc.id, botId: bot.id, from: mid, to: range.historyTo });
  assert(btHalf.from >= mid && btHalf.to <= range.historyTo, `custom window ${btHalf.from}..${btHalf.to}`);
  assert(btHalf.quotes.every((q) => q.time >= mid && q.time <= range.historyTo), 'custom window quotes within [from,to]');

  console.log('[autotune]');
  const at = await api.autotune.run({ strategyConfigId: st.id, marketConfigId: mc.id, botId: bot.id, maxCombos: 24 });
  assert(at.combos.length > 1, `autotune combos = ${at.combos.length}`);
  assert(at.best !== null, 'autotune has a best combo');
  for (let i = 1; i < at.combos.length; i++) {
    if (at.combos[i - 1].stats.pnl < at.combos[i].stats.pnl) throw new Error('combos not ranked by PnL');
  }
  assert(true, 'combos ranked by PnL desc');

  console.log('[cleanup]');
  await api.bots.update(bot.id, { status: 'stopped' });
  await api.strategyConfigs.remove(st.id);
  await api.marketConfigs.remove(mc.id);
  assert(true, 'cleanup done');

  console.log('\n✅ LIVE SMOKE PASSED');
}

main().catch((e) => {
  console.error('\n❌ LIVE SMOKE FAILED:', e.message);
  process.exit(1);
});
