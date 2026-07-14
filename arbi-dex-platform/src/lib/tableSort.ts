export type SortDirection = 'asc' | 'desc'

export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' })
}

export function sortItems<T>(
  items: T[],
  getValue: (item: T) => unknown,
  direction: SortDirection,
): T[] {
  const sorted = [...items].sort((a, b) => compareValues(getValue(a), getValue(b)))
  return direction === 'desc' ? sorted.reverse() : sorted
}
