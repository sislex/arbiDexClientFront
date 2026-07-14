import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { UndoDeleteToast } from '../components/ui/UndoDeleteToast'
import { loadBots, saveBots } from '../lib/botsStorage'
import { loadStrategies, saveStrategies } from '../lib/strategiesStorage'
import { removeStrategyRulesForId } from '../lib/strategyRulesStorage'
import { loadTradingPairs, saveTradingPairs } from '../lib/tradingPairsStorage'

export const UNDO_DELETE_DELAY_MS = 4000

export type DeleteEntityType = 'bot' | 'pair' | 'strategy'

export interface ScheduleDeleteOptions {
  entityType: DeleteEntityType
  entityId: string
  message: string
}

interface PendingDeleteToast {
  id: string
  entityType: DeleteEntityType
  entityId: string
  message: string
}

interface PendingEntityKey {
  entityType: DeleteEntityType
  entityId: string
}

interface UndoDeleteContextValue {
  scheduleDelete: (options: ScheduleDeleteOptions) => void
  isEntityPending: (entityType: DeleteEntityType, entityId: string) => boolean
  deleteRevision: number
  pendingKeys: string[]
}

const UndoDeleteContext = createContext<UndoDeleteContextValue | null>(null)

function createPendingId() {
  return `undo-delete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function entityKey(entityType: DeleteEntityType, entityId: string): string {
  return `${entityType}:${entityId}`
}

function commitEntityDelete(entityType: DeleteEntityType, entityId: string) {
  switch (entityType) {
    case 'bot':
      saveBots(loadBots().filter((item) => item.id !== entityId))
      break
    case 'pair':
      saveTradingPairs(loadTradingPairs().filter((item) => item.id !== entityId))
      break
    case 'strategy':
      saveStrategies(loadStrategies().filter((item) => item.id !== entityId))
      removeStrategyRulesForId(entityId)
      break
  }
}

export function UndoDeleteProvider({ children }: { children: ReactNode }) {
  const [pendingToasts, setPendingToasts] = useState<PendingDeleteToast[]>([])
  const [pendingEntities, setPendingEntities] = useState<PendingEntityKey[]>([])
  const [deleteRevision, setDeleteRevision] = useState(0)
  const timeoutsRef = useRef<Map<string, number>>(new Map())
  const pendingToastsRef = useRef<PendingDeleteToast[]>([])
  const pendingEntitiesRef = useRef<PendingEntityKey[]>([])

  useEffect(() => {
    pendingToastsRef.current = pendingToasts
  }, [pendingToasts])

  useEffect(() => {
    pendingEntitiesRef.current = pendingEntities
  }, [pendingEntities])

  const bumpRevision = useCallback(() => {
    setDeleteRevision((value) => value + 1)
  }, [])

  const removePendingEntity = useCallback((entityType: DeleteEntityType, entityId: string) => {
    setPendingEntities((current) =>
      current.filter(
        (entry) => !(entry.entityType === entityType && entry.entityId === entityId),
      ),
    )
  }, [])

  const removeToast = useCallback((toastId: string) => {
    const timeout = timeoutsRef.current.get(toastId)
    if (timeout !== undefined) {
      window.clearTimeout(timeout)
      timeoutsRef.current.delete(toastId)
    }
    setPendingToasts((current) => current.filter((item) => item.id !== toastId))
  }, [])

  const finalizeDelete = useCallback(
    (toastId: string) => {
      const item = pendingToastsRef.current.find((entry) => entry.id === toastId)
      if (!item) return

      commitEntityDelete(item.entityType, item.entityId)
      removePendingEntity(item.entityType, item.entityId)
      removeToast(toastId)
      bumpRevision()
    },
    [bumpRevision, removePendingEntity, removeToast],
  )

  const cancelDelete = useCallback(
    (toastId: string) => {
      const item = pendingToastsRef.current.find((entry) => entry.id === toastId)
      if (!item) return

      removePendingEntity(item.entityType, item.entityId)
      removeToast(toastId)
      bumpRevision()
    },
    [bumpRevision, removePendingEntity, removeToast],
  )

  const scheduleDelete = useCallback(
    (options: ScheduleDeleteOptions) => {
      const key = entityKey(options.entityType, options.entityId)
      const alreadyPending = pendingEntitiesRef.current.some(
        (entry) => entityKey(entry.entityType, entry.entityId) === key,
      )
      if (alreadyPending) return

      const toastId = createPendingId()
      const nextToast: PendingDeleteToast = {
        id: toastId,
        entityType: options.entityType,
        entityId: options.entityId,
        message: options.message,
      }

      setPendingEntities((current) => [
        ...current,
        { entityType: options.entityType, entityId: options.entityId },
      ])
      setPendingToasts((current) => [...current, nextToast])

      const timeoutId = window.setTimeout(() => finalizeDelete(toastId), UNDO_DELETE_DELAY_MS)
      timeoutsRef.current.set(toastId, timeoutId)
    },
    [finalizeDelete],
  )

  const isEntityPending = useCallback(
    (entityType: DeleteEntityType, entityId: string) =>
      pendingEntities.some(
        (entry) => entry.entityType === entityType && entry.entityId === entityId,
      ),
    [pendingEntities],
  )

  const pendingKeys = useMemo(
    () => pendingEntities.map((entry) => entityKey(entry.entityType, entry.entityId)),
    [pendingEntities],
  )

  useEffect(
    () => () => {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      timeoutsRef.current.clear()
    },
    [],
  )

  return (
    <UndoDeleteContext.Provider value={{ scheduleDelete, isEntityPending, deleteRevision, pendingKeys }}>
      {children}
      {pendingToasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
          {pendingToasts.map((item) => (
            <UndoDeleteToast
              key={item.id}
              message={item.message}
              onCancel={() => cancelDelete(item.id)}
            />
          ))}
        </div>
      )}
    </UndoDeleteContext.Provider>
  )
}

export function useUndoDelete() {
  const context = useContext(UndoDeleteContext)
  if (!context) {
    throw new Error('useUndoDelete must be used within UndoDeleteProvider')
  }
  return context
}
