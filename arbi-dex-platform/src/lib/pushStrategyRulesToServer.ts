import { getStoredBots } from './botsStorage'
import { buildServerStrategySides } from './mapPlatformStrategyToServer'
import {
  fetchStrategyConfigs,
  fetchStrategyDefaults,
  updateStrategyConfig,
} from '../services/configApi'
import { fetchServerBots } from '../services/botsApi'

export const STRATEGY_CONFIG_UPDATED_EVENT = 'arbi:strategy-config-updated'

export interface StrategyConfigUpdatedDetail {
  strategyId: string
  strategyName: string
  configIds: string[]
  /** Боты, которые были running/paused и останавливаются на сервере. */
  stoppedBotIds: string[]
}

/** Push platform strategy rules (localStorage) to matching server strategy configs. */
export async function pushStrategyRulesToServer(
  strategyId: string,
  strategyName: string,
): Promise<string[]> {
  const name = strategyName.trim()
  const [defaults, configs, serverBots] = await Promise.all([
    fetchStrategyDefaults(),
    fetchStrategyConfigs(),
    fetchServerBots().catch(() => []),
  ])
  const sides = buildServerStrategySides(strategyId, defaults)
  const payload = { name, buy: sides.buy, sell: sides.sell }

  const ids = new Set<string>()

  for (const config of configs) {
    if (config.name === name) ids.add(config.id)
  }

  for (const bot of getStoredBots()) {
    if (bot.strategyConfigId && (bot.strategyId === strategyId || bot.strategy === name)) {
      ids.add(bot.strategyConfigId)
    }
  }

  const configById = new Map(configs.map((c) => [c.id, c]))
  for (const bot of serverBots) {
    const cfg = configById.get(bot.strategyConfigId)
    if (cfg?.name === name) ids.add(bot.strategyConfigId)
  }

  const configIds = [...ids]
  if (configIds.length === 0) return []

  // PATCH стратегии на сервере закрывает сессии и останавливает связанных ботов.
  await Promise.all(configIds.map((id) => updateStrategyConfig(id, payload)))

  const stoppedBotIds = serverBots
    .filter(
      (b) =>
        ids.has(b.strategyConfigId) && (b.status === 'running' || b.status === 'paused'),
    )
    .map((b) => b.id)

  window.dispatchEvent(
    new CustomEvent<StrategyConfigUpdatedDetail>(STRATEGY_CONFIG_UPDATED_EVENT, {
      detail: { strategyId, strategyName: name, configIds, stoppedBotIds },
    }),
  )
  return configIds
}
