import { useCallback, useState } from 'react'
import { sortItems, type SortDirection } from '../lib/tableSort'

export function useTableSort<K extends string>(defaultKey?: K, defaultDir: SortDirection = 'asc') {
  const [sortKey, setSortKey] = useState<K | null>(defaultKey ?? null)
  const [direction, setDirection] = useState<SortDirection>(defaultDir)

  const toggleSort = useCallback(
    (key: K) => {
      if (sortKey === key) {
        setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setDirection('asc')
      }
    },
    [sortKey],
  )

  const sort = useCallback(
    <T,>(items: T[], getValue: (item: T, key: K) => unknown): T[] => {
      if (!sortKey) return items
      return sortItems(items, (item) => getValue(item, sortKey), direction)
    },
    [sortKey, direction],
  )

  return { sortKey, direction, toggleSort, sort }
}
