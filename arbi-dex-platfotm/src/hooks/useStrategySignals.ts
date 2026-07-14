import { useCallback, useEffect, useRef, useState } from 'react'
import type { StrategySignal } from '../components/bot/StrategySignalToast'
import type { SimulationLogEvent } from '../simulation/simulationViewerTypes'

const MAX_SIGNALS = 4
const SIGNAL_TTL_MS = 2000

function createSignal(type: 'buy' | 'sell', message: string, time: string): StrategySignal {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    time,
  }
}

function pushSignal(prev: StrategySignal[], next: StrategySignal) {
  return [next, ...prev].slice(0, MAX_SIGNALS)
}

export function useStrategySignalsFromSimulation(enabled: boolean) {
  const [signals, setSignals] = useState<StrategySignal[]>([])
  const lastStepIdxRef = useRef(-1)

  const onStepResultChange = useCallback(
    (stepResult: SimulationLogEvent | null) => {
      if (!enabled || !stepResult) return
      const idx = stepResult.dataIdx
      if (idx <= lastStepIdxRef.current) return

      const decision = stepResult.detail?.decision
      const isBuy = stepResult.type === 'Buy' || decision === 'BUY'
      const isSell = stepResult.type === 'Sell' || decision === 'SELL'
      if (!isBuy && !isSell) return

      lastStepIdxRef.current = idx
      setSignals((prev) =>
        pushSignal(
          prev,
          createSignal(
            isBuy ? 'buy' : 'sell',
            stepResult.message || (isBuy ? 'Условия покупки выполнены' : 'Условия продажи выполнены'),
            stepResult.time,
          ),
        ),
      )
    },
    [enabled],
  )

  useEffect(() => {
    if (!enabled) {
      lastStepIdxRef.current = -1
      setSignals([])
    }
  }, [enabled])

  const dismissSignal = useCallback((id: string) => {
    setSignals((prev) => prev.filter((s) => s.id !== id))
  }, [])

  useEffect(() => {
    if (signals.length === 0) return
    const timers = signals.map((signal) =>
      window.setTimeout(() => {
        setSignals((prev) => prev.filter((s) => s.id !== signal.id))
      }, SIGNAL_TTL_MS),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [signals])

  return { signals, dismissSignal, onStepResultChange }
}
