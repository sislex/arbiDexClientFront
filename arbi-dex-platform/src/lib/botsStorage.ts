import type { Bot } from '../data/mockData'
import { BOTS } from '../data/mockData'

export const BOTS_STORAGE_KEY = 'arbidex-bots'

function normalizeBot(raw: Bot): Bot {
  const balance = raw.balance ?? raw.startingBudget ?? 500

  return {
    ...raw,
    name: raw.name?.trim() || 'Bot',
    strategy: raw.strategy || 'Strategy',
    strategyId: raw.strategyId || '',
    pair: raw.pair || 'BTC/USDT',
    pairSetId: raw.pairSetId,
    balance,
    roi: raw.roi ?? 0,
    profit: raw.profit ?? 0,
    winRate: raw.winRate ?? 0,
    drawdown: raw.drawdown ?? 0,
    trades: raw.trades ?? 0,
    lastTrade: raw.lastTrade ?? '—',
    runtime: raw.runtime ?? '0d',
    status: raw.status ?? 'active',
    startingBudget: raw.startingBudget ?? balance,
    maxTurnover: raw.maxTurnover ?? Math.max(balance, 700),
    minStopBudget: raw.minStopBudget ?? Math.min(balance, 300),
    peakStopPercent: raw.peakStopPercent ?? 10,
    profitCurrency: raw.profitCurrency ?? 'USDT',
    serverBotId: raw.serverBotId,
    marketConfigId: raw.marketConfigId,
    strategyConfigId: raw.strategyConfigId,
  }
}

export function loadBots(fallback: Bot[] = BOTS): Bot[] {
  if (typeof window === 'undefined') return fallback.map(normalizeBot)
  try {
    const raw = localStorage.getItem(BOTS_STORAGE_KEY)
    if (!raw) return fallback.map(normalizeBot)
    const parsed = JSON.parse(raw) as Bot[]
    if (!Array.isArray(parsed)) return fallback.map(normalizeBot)
    return parsed.map(normalizeBot)
  } catch {
    return fallback.map(normalizeBot)
  }
}

export function saveBots(bots: Bot[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(BOTS_STORAGE_KEY, JSON.stringify(bots.map(normalizeBot)))
  } catch {
    // ignore quota / private mode errors
  }
}

export function getStoredBots(): Bot[] {
  return loadBots(BOTS)
}
