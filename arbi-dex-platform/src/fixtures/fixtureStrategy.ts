import type { Strategy } from "../simulation/simulationStrategy";

export const FIXTURE_CHART_STRATEGY_ID = "fixture-crossing-chart";

export const FIXTURE_CHART_NETWORK_ID = "binance-eth-usdt";

export function isFixtureChartStrategy(strategy: Strategy | null | undefined): boolean {
  return strategy?.id === FIXTURE_CHART_STRATEGY_ID;
}

export const FIXTURE_CHART_STRATEGY: Strategy = {
  id: FIXTURE_CHART_STRATEGY_ID,
  name: "Fixture: Crossing Chart (1000)",
  pair: [
    {
      pair: "ETH/USDT",
      exchange: "Binance",
      bidKey: "binance|ETH/USDT|bidPrice",
      askKey: "binance|ETH/USDT|askPrice",
    },
  ],
  sources: [
    {
      id: FIXTURE_CHART_NETWORK_ID,
      label: "Binance",
      pair: "ETH/USDT",
      bidKey: "binance|ETH/USDT|bidPrice",
      askKey: "binance|ETH/USDT|askPrice",
      type: "cex",
    },
  ],
  exchange: "Binance",
  networks: ["Binance"],
  rules: 6,
  risk: "Low",
  status: "Paused",
  lastActivity: "fixture",
  enabled: false,
  pnl: "0",
  pnlPositive: true,
  profitCurrency: "USDT",
  ruleConfigs: [
    { id: "fx-buy-enabled", conditionId: "buy-avg-above-buy-price", threshold: "0", action: "BUY", enabled: true },
    {
      id: "fx-buy-steps-pct",
      conditionId: "buy-avg-above-buy-price-for-last-steps-percent",
      threshold: "1",
      action: "BUY",
      enabled: true,
    },
    {
      id: "fx-buy-steps-count",
      conditionId: "buy-avg-above-buy-price-for-last-steps-count",
      threshold: "5",
      action: "BUY",
      enabled: true,
    },
    { id: "fx-buy-no-tx", conditionId: "block-buy-while-transaction-running", threshold: "0", action: "BUY", enabled: true },
    { id: "fx-buy-spread", conditionId: "block-buy-when-buy-above-sell", threshold: "50", action: "BUY", enabled: true },
    { id: "fx-buy-delay", conditionId: "block-buy-after-last-transaction", threshold: "60000", action: "BUY", enabled: true },
    { id: "fx-sell-enabled", conditionId: "sell-avg-below-sell-price", threshold: "0", action: "SELL", enabled: true },
    {
      id: "fx-sell-steps-pct",
      conditionId: "sell-avg-above-sell-price-for-last-steps-percent",
      threshold: "1",
      action: "SELL",
      enabled: true,
    },
    {
      id: "fx-sell-steps-count",
      conditionId: "sell-avg-above-sell-price-for-last-steps-count",
      threshold: "5",
      action: "SELL",
      enabled: true,
    },
    { id: "fx-sell-no-tx", conditionId: "block-sell-while-transaction-running", threshold: "0", action: "SELL", enabled: true },
    { id: "fx-sell-delay", conditionId: "block-sell-after-last-transaction", threshold: "60000", action: "SELL", enabled: true },
  ],
};
