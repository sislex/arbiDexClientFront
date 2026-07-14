import type { Strategy } from "./simulationStrategy";
import {
  buildNetworksFromStrategy,
  normalizeToken,
  resolveStrategyTokenSymbols,
} from "./simulationNetworkTypes";

export interface SimulationDisplayContext {
  displayNetworks: Array<{ id: string; label: string; color: string }>;
  tradingNetworkIds: Set<string>;
  token1Label: string;
  token2Label: string;
  pairLabel: string;
  networksLabel: string;
  strategyId?: string;
  status?: string;
  rules?: number;
  profitCurrency?: string;
}

export function buildTradingNetworkIds(
  strategy: Strategy,
  networks: ReturnType<typeof buildNetworksFromStrategy>,
): Set<string> {
  const ids = new Set<string>();
  for (const net of networks) {
    const netLabelToken = normalizeToken(net.label);
    for (const pair of strategy.pair) {
      const pairToken = normalizeToken(`${pair.exchange}${pair.pair}`);
      const exactByKey = Boolean(
        pair.bidKey && pair.askKey && pair.bidKey === net.bidKey && pair.askKey === net.askKey,
      );
      const byLabel = pairToken.length > 0 && netLabelToken.includes(pairToken);
      if (exactByKey || byLabel) {
        ids.add(net.id);
        break;
      }
    }
  }
  if (ids.size === 0 && networks[0]) ids.add(networks[0].id);
  return ids;
}

export function buildSimulationContextFromStrategy(strategy: Strategy): SimulationDisplayContext {
  const networks = buildNetworksFromStrategy(strategy);
  const displayNetworks = networks.map((n) => ({ id: n.id, label: n.label, color: n.color }));
  const tokens = resolveStrategyTokenSymbols(strategy);

  return {
    displayNetworks,
    tradingNetworkIds: buildTradingNetworkIds(strategy, networks),
    token1Label: tokens.token1,
    token2Label: tokens.token2,
    pairLabel: strategy.pair.map((p) => p.pair).join(" · "),
    networksLabel: displayNetworks.map((n) => n.label).join(" · "),
    strategyId: strategy.id,
    status: strategy.status,
    rules: strategy.rules,
    profitCurrency: strategy.profitCurrency,
  };
}
