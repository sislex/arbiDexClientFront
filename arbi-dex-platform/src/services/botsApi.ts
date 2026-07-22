import { loadAuthResult } from '../lib/authStorage'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function apiRequest<T>(path: string, init?: RequestInit & { query?: Record<string, string | number | undefined> }): Promise<T> {
  const auth = loadAuthResult()

  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  if (init?.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
  }

  const { query: _query, ...fetchInit } = init ?? {}
  const response = await fetch(url.toString(), {
    ...fetchInit,
    headers: {
      ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      ...(fetchInit.body ? { 'Content-Type': 'application/json' } : {}),
      ...fetchInit.headers,
    },
  })

  if (!response.ok) {
    let message = `API ${response.status}`
    try {
      const data = (await response.json()) as { message?: string | string[] }
      if (Array.isArray(data.message)) message = data.message.join(', ')
      else if (typeof data.message === 'string') message = data.message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export interface ServerQuotePoint {
  time: number
  buyQuote: number
  sellQuote: number
  avgObservedQuote: number
}

export interface ServerStepConditionOutcome {
  passed: boolean
  actual?: number
  required?: number
}

export interface ExcludedTimeRange {
  start: number
  end: number
}

export interface ServerStepEngineResult {
  transaction: { buy: boolean; sell: boolean; forcedSell: boolean }
  condition: {
    buy: Record<string, ServerStepConditionOutcome>
    sell: Record<string, ServerStepConditionOutcome>
  }
  meta: {
    lastStepTime: number
    transactionInProgress: boolean
    lastFinishedTransactionTime: number | null
  }
}

export interface ServerBacktestStepRecord {
  index: number
  step: {
    time: number
    quotes: {
      buyQuote: number
      sellQuote: number
      avgObservedQuote: number
    }
  }
  result: ServerStepEngineResult
}

export interface ServerBacktestStepResults {
  records: ServerBacktestStepRecord[]
}

export interface ServerBacktestResult {
  id: string
  from: number
  to: number
  quotes: ServerQuotePoint[]
  trades: Array<{
    id: string
    time: number
    side: 'buy' | 'sell'
    price: number
    amount: number
    pnl?: number
    reason?: string
  }>
  stats: {
    trades: number
    pnl: number
    pnlPct: number
    winRate: number
    maxDrawdownPct: number
    finalBalance: number
  }
  historyFrom: number
  historyTo: number
  stepResults: ServerBacktestStepResults
  tookMs: number
  evaluatedSteps?: number
  stepsTruncated?: boolean
}

export interface ServerBotStepResult extends ServerStepEngineResult {
  step: ServerQuotePoint
  index: number
  totalSteps: number
  windowSteps: number
  historyFrom: number
  historyTo: number
  tookMs: number
  skipped?: {
    reason: string
    range: ExcludedTimeRange
  }
}

export interface ServerBot {
  id: string
  name: string
  status: string
  mode: string
  marketConfigId: string
  strategyConfigId: string
  baseAsset: string
  quoteAsset: string
  initialBalance: number
  balance: number
  pnl: number
  pnlPct: number
  tradesCount: number
  winRate: number
  openPosition: boolean
  positionSize?: number
  entryPrice?: number
  positionOpenedAt?: number
  slippagePct?: number
  createdAt: string
  updatedAt: string
}

export type ServerBotStatus = 'running' | 'paused' | 'stopped' | 'error'
export type ServerBotMode = 'demo-live' | 'real-live' | 'idle'

export interface ServerBotUpdatePayload {
  name?: string
  mode?: ServerBotMode
  status?: ServerBotStatus
  marketConfigId?: string
  strategyConfigId?: string
  baseAsset?: string
  quoteAsset?: string
  initialBalance?: number
  slippagePct?: number
}

export interface ServerBotCreatePayload {
  name: string
  marketConfigId: string
  strategyConfigId: string
  mode?: ServerBotMode
  status?: ServerBotStatus
  baseAsset?: string
  quoteAsset?: string
  initialBalance?: number
  slippagePct?: number
}

export function isServerBotId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export function fetchServerBots(): Promise<ServerBot[]> {
  return apiRequest<ServerBot[]>('/bots')
}

export function fetchServerBot(botId: string): Promise<ServerBot> {
  return apiRequest<ServerBot>(`/bots/${botId}`)
}

export function createServerBot(payload: ServerBotCreatePayload): Promise<ServerBot> {
  return apiRequest<ServerBot>('/bots', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateServerBot(botId: string, payload: ServerBotUpdatePayload): Promise<ServerBot> {
  return apiRequest<ServerBot>(`/bots/${botId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteServerBot(botId: string): Promise<void> {
  return apiRequest<void>(`/bots/${botId}`, { method: 'DELETE' })
}

export function fetchBotHistoryRange(botId: string): Promise<{ historyFrom: number; historyTo: number }> {
  return apiRequest(`/bots/${botId}/history-range`)
}

export function fetchBotQuotes(
  botId: string,
  params: { from?: number; to?: number } = {},
): Promise<{ quotes: ServerQuotePoint[]; from: number; to: number; historyFrom: number; historyTo: number }> {
  return apiRequest(`/bots/${botId}/quotes`, {
    query: { from: params.from, to: params.to },
  })
}

export function runServerBacktest(
  botId: string,
  params: { from?: number; to?: number; excludedRanges?: ExcludedTimeRange[] } = {},
): Promise<ServerBacktestResult> {
  return apiRequest<ServerBacktestResult>(`/bots/${botId}/backtest`, {
    method: 'POST',
    query: { from: params.from, to: params.to },
    body: JSON.stringify({
      excludedRanges: params.excludedRanges ?? [],
    }),
  })
}

export function fetchServerStepResult(
  botId: string,
  params: { time: number; entryPrice?: number; openedAt?: number; size?: number; excludedRanges?: ExcludedTimeRange[] },
): Promise<ServerBotStepResult> {
  return apiRequest<ServerBotStepResult>(`/bots/${botId}/step-result`, {
    query: {
      time: params.time,
      entryPrice: params.entryPrice,
      openedAt: params.openedAt,
      size: params.size,
      excludedRanges:
        params.excludedRanges && params.excludedRanges.length > 0
          ? JSON.stringify(params.excludedRanges)
          : undefined,
    },
  })
}

export interface ServerBotTrade {
  id: string
  botId: string
  time: number
  side: 'buy' | 'sell'
  status: 'success' | 'failed'
  mode: 'demo' | 'real'
  price: number | null
  expectedPrice: number | null
  amountIn: number
  amountOut: number | null
  pnl: number | null
  error: string | null
}

export interface ServerBotTradeResult {
  trade: ServerBotTrade
  bot: ServerBot
}

export function fetchBotTrades(
  botId: string,
  params: { from?: number; to?: number } = {},
): Promise<ServerBotTrade[]> {
  return apiRequest<ServerBotTrade[]>(`/bots/${botId}/trades`, {
    query: { from: params.from, to: params.to },
  })
}

export function executeBotTrade(
  botId: string,
  payload: { side: 'buy' | 'sell'; expectedPrice?: number; amount?: number },
): Promise<ServerBotTradeResult> {
  return apiRequest<ServerBotTradeResult>(`/bots/${botId}/trade`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
