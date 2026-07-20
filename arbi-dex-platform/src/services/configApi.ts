import { loadAuthResult } from '../lib/authStorage'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = loadAuthResult()
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
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

export interface MarketConfigSummary {
  id: string
  name: string
  tradingMarketId?: string | null
  observedMarketIds?: string[]
  useWeightedAverage?: boolean
}

export interface MarketConfigDetail extends MarketConfigSummary {
  observedMarketIds: string[]
  useWeightedAverage: boolean
  weights?: Record<string, number>
}

export interface UpdateMarketConfigPayload {
  name?: string
  tradingMarketId?: string | null
  observedMarketIds?: string[]
  useWeightedAverage?: boolean
  weights?: Record<string, number>
}

export interface StrategyConfigSummary {
  id: string
  name: string
}

export interface StrategyDefaults {
  buy: unknown[]
  sell: unknown[]
}

export interface CatalogMarket {
  id: string
  sourceId: string
  sourceName: string
  kind: 'cex' | 'dex'
  pairId: string
  base: string
  quote: string
}

export interface CreateMarketConfigPayload {
  name: string
  tradingMarketId?: string | null
  observedMarketIds: string[]
  useWeightedAverage?: boolean
  weights?: Record<string, number>
}

export interface CreateStrategyConfigPayload {
  name: string
  buy: unknown[]
  sell: unknown[]
}

export function fetchMarketConfigs(): Promise<MarketConfigSummary[]> {
  return apiRequest<MarketConfigSummary[]>('/market-configs')
}

export function fetchMarketConfig(id: string): Promise<MarketConfigDetail> {
  return apiRequest<MarketConfigDetail>(`/market-configs/${id}`)
}

export function fetchStrategyConfigs(): Promise<StrategyConfigSummary[]> {
  return apiRequest<StrategyConfigSummary[]>('/strategy-configs')
}

export function fetchStrategyDefaults(): Promise<StrategyDefaults> {
  return apiRequest<StrategyDefaults>('/strategy-configs/defaults')
}

export function fetchCatalogMarkets(): Promise<CatalogMarket[]> {
  return apiRequest<CatalogMarket[]>('/catalog/markets')
}

export function createMarketConfig(payload: CreateMarketConfigPayload): Promise<MarketConfigSummary> {
  return apiRequest<MarketConfigSummary>('/market-configs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateMarketConfig(
  id: string,
  payload: UpdateMarketConfigPayload,
): Promise<MarketConfigDetail> {
  return apiRequest<MarketConfigDetail>(`/market-configs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function createStrategyConfig(payload: CreateStrategyConfigPayload): Promise<StrategyConfigSummary> {
  return apiRequest<StrategyConfigSummary>('/strategy-configs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateStrategyConfig(
  id: string,
  payload: CreateStrategyConfigPayload,
): Promise<StrategyConfigSummary> {
  return apiRequest<StrategyConfigSummary>(`/strategy-configs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
