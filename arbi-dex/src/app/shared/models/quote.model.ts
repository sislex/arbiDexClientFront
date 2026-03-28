export interface Quote {
  sourceId: string;
  pairId: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPct: number;
  timestamp: number;
}

