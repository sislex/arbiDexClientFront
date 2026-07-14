import type { Strategy } from "./simulationStrategy";

export interface NetworkSource {
  id: string;
  label: string;
  color: string;
  bidKey: string;
  askKey: string;
  transform: (v: number) => number;
}

export const NETWORK_COLORS = [
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#F97316",
  "#22C55E",
  "#EAB308",
  "#06B6D4",
  "#EF4444",
];

export const DEFAULT_NETWORKS: NetworkSource[] = [
  {
    id: "binance-eth-usdt",
    label: "Binance ETH/USDT",
    color: "#3B82F6",
    bidKey: "binance|ETH/USDT|bidPrice",
    askKey: "binance|ETH/USDT|askPrice",
    transform: (v: number) => v,
  },
  {
    id: "bybit-eth-usdt",
    label: "Bybit ETH/USDT",
    color: "#10B981",
    bidKey: "bybit|ETH/USDT|bidPrice",
    askKey: "bybit|ETH/USDT|askPrice",
    transform: (v: number) => v,
  },
];

export function exchangeId(exchange: string): string {
  return exchange.toLowerCase().replace(/\s+/g, "");
}

export function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function resolveStrategyTokenSymbols(strategy: Strategy | null): { token1: string; token2: string } {
  const primaryPair = strategy?.pair?.[0]?.pair ?? "";
  const [rawToken1, rawToken2] = primaryPair.split("/");
  const token1 = (rawToken1 ?? "").trim() || "token1";
  const token2 = (rawToken2 ?? "").trim() || "token2";
  return { token1, token2 };
}

export function buildNetworksFromStrategy(strategy: Strategy | null): NetworkSource[] {
  if (!strategy || strategy.pair.length === 0) return DEFAULT_NETWORKS;
  const fromSources = (strategy.sources ?? []).map((source, index) => ({
    id: source.id.replace(/[^a-z0-9_-]+/gi, "-"),
    label: `${source.label} ${source.pair}`,
    color: NETWORK_COLORS[index % NETWORK_COLORS.length],
    bidKey: source.bidKey,
    askKey: source.askKey,
    transform: (v: number) => v,
  }));
  if (fromSources.length > 0) {
    return fromSources;
  }

  const fromPairs = strategy.pair
    .map((item, index) => {
      const ex = exchangeId(item.exchange);
      const fallbackBidKey = `${ex}|${item.pair}|bidPrice`;
      const fallbackAskKey = `${ex}|${item.pair}|askPrice`;
      const bidKey = item.bidKey ?? fallbackBidKey;
      const askKey = item.askKey ?? fallbackAskKey;
      if (!bidKey || !askKey) return null;
      const idBase = `${item.exchange}-${item.pair}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return {
        id: `${idBase}-${index}`,
        label: `${item.exchange} ${item.pair}`,
        color: NETWORK_COLORS[index % NETWORK_COLORS.length],
        bidKey,
        askKey,
        transform: (v: number) => v,
      } satisfies NetworkSource;
    })
    .filter((row): row is NetworkSource => row !== null);

  if (fromPairs.length > 0) {
    const seen = new Set<string>();
    return fromPairs.filter((net) => {
      const key = `${net.bidKey}__${net.askKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return strategy.pair.map((item, index) => {
    const ex = exchangeId(item.exchange);
    const id = `${ex}-${item.pair.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return {
      id,
      label: `${item.exchange} ${item.pair}`,
      color: NETWORK_COLORS[index % NETWORK_COLORS.length],
      bidKey: item.bidKey ?? `${ex}|${item.pair}|bidPrice`,
      askKey: item.askKey ?? `${ex}|${item.pair}|askPrice`,
      transform: (v: number) => v,
    };
  });
}
