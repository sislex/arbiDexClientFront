import { getStoredBots } from './botsStorage'
import { buildServerStrategySides } from './mapPlatformStrategyToServer'
import {
  fetchStrategyConfigs,
  fetchStrategyDefaults,
  updateStrategyConfig,
} from '../services/configApi'

export const STRATEGY_CONFIG_UPDATED_EVENT = 'arbi:strategy-config-updated'

export interface StrategyConfigUpdatedDetail {
  strategyId: string
  strategyName: string
  configIds: string[]
}

/** Push platform strategy rules (localStorage) to matching server strategy configs. */
export async function pushStrategyRulesToServer(
  strategyId: string,
  strategyName: string,
): Promise<string[]> {
  const [defaults, configs] = await Promise.all([
    fetchStrategyDefaults(),
    fetchStrategyConfigs(),
  ])
  const sides = buildServerStrategySides(strategyId, defaults)
  const payload = { name: strategyName.trim(), buy: sides.buy, sell: sides.sell }

  const ids = new Set<string>()
  for (const config of configs) {
    if (config.name === strategyName.trim()) ids.add(config.id)
  }
  for (const bot of getStoredBots()) {
    if (bot.strategyId === strategyId && bot.strategyConfigId) {
      ids.add(bot.strategyConfigId)
    }
  }

  await Promise.all([...ids].map((id) => updateStrategyConfig(id, payload)))

  const configIds = [...ids]
  window.dispatchEvent(
    new CustomEvent<StrategyConfigUpdatedDetail>(STRATEGY_CONFIG_UPDATED_EVENT, {
      detail: { strategyId, strategyName: strategyName.trim(), configIds },
    }),
  )
  return configIds
}
