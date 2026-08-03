import type { Bot } from '../data/mockData'

export interface BotLaunchSettings {
  startingBudget: string
  maxTurnover: string
  minStopBudget: string
  peakStopPercent: string
  profitCurrency: string
  slippagePct: string
}

export interface BotDraft {
  name: string
  pairSetId: string
  pair: string
  strategyIds: string[]
  launch: BotLaunchSettings
  status: Bot['status']
}

export const DEFAULT_BOT_LAUNCH: BotLaunchSettings = {
  startingBudget: '500',
  maxTurnover: '700',
  minStopBudget: '300',
  peakStopPercent: '10',
  profitCurrency: 'USDT',
  slippagePct: '0.5',
}

export function botDraftToSearchParams(draft: BotDraft): Record<string, string> {
  const out: Record<string, string> = {}
  if (draft.name.trim()) out.name = draft.name.trim()
  if (draft.pairSetId) out.pairSetId = draft.pairSetId
  if (draft.pair) out.pair = draft.pair
  if (draft.strategyIds.length > 0) out.strategies = draft.strategyIds.join(',')
  if (draft.launch.startingBudget) out.startingBudget = draft.launch.startingBudget
  if (draft.launch.maxTurnover) out.maxTurnover = draft.launch.maxTurnover
  if (draft.launch.minStopBudget) out.minStopBudget = draft.launch.minStopBudget
  if (draft.launch.peakStopPercent) out.peakStopPercent = draft.launch.peakStopPercent
  if (draft.launch.profitCurrency) out.profitCurrency = draft.launch.profitCurrency
  if (draft.launch.slippagePct) out.slippagePct = draft.launch.slippagePct
  if (draft.status) out.status = draft.status
  return out
}

export function botDraftFromSearchParams(params: URLSearchParams, fallback: BotDraft): BotDraft {
  const strategiesRaw = params.get('strategies')
  const strategyIds = strategiesRaw
    ? strategiesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : fallback.strategyIds

  return {
    name: params.get('name') ?? fallback.name,
    pairSetId: params.get('pairSetId') ?? fallback.pairSetId,
    pair: params.get('pair') ?? fallback.pair,
    strategyIds,
    launch: {
      startingBudget: params.get('startingBudget') ?? fallback.launch.startingBudget,
      maxTurnover: params.get('maxTurnover') ?? fallback.launch.maxTurnover,
      minStopBudget: params.get('minStopBudget') ?? fallback.launch.minStopBudget,
      peakStopPercent: params.get('peakStopPercent') ?? fallback.launch.peakStopPercent,
      profitCurrency: params.get('profitCurrency') ?? fallback.launch.profitCurrency,
      slippagePct: params.get('slippagePct') ?? fallback.launch.slippagePct ?? '0.5',
    },
    status: (params.get('status') as Bot['status'] | null) ?? fallback.status,
  }
}

export function botToDraft(bot: Bot): BotDraft {
  return {
    name: bot.name,
    pairSetId: bot.pairSetId ?? '',
    pair: bot.pair,
    strategyIds: bot.strategyId ? [bot.strategyId] : [],
    launch: {
      startingBudget: String(bot.startingBudget ?? bot.balance ?? 500),
      maxTurnover: String(bot.maxTurnover ?? 700),
      minStopBudget: String(bot.minStopBudget ?? 300),
      peakStopPercent: String(bot.peakStopPercent ?? 10),
      profitCurrency: bot.profitCurrency ?? 'USDT',
      slippagePct: String(bot.slippagePct ?? 0.5),
    },
    status: bot.status,
  }
}
