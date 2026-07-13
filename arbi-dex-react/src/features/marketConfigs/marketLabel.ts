import type { Market } from '../../domain/types';

export function marketLabel(m: Market): string {
  return `${m.sourceName} · ${m.base}/${m.quote}`;
}

export function findMarket(markets: Market[], id: string): Market | undefined {
  return markets.find((m) => m.id === id);
}
