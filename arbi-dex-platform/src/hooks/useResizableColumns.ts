import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export interface ResizableColumnConfig {
  id: string
  defaultPercent: number
  minPercent?: number
}

const STORAGE_PREFIX = 'arbidex-table-cols-'

function normalizeTo100(values: number[], mins: number[]): number[] {
  const clamped = values.map((v, i) => Math.max(mins[i] ?? 4, v))
  const sum = clamped.reduce((a, b) => a + b, 0)
  if (sum <= 0) return values
  return clamped.map((v) => (v / sum) * 100)
}

function loadWidths(tableId: string, columns: ResizableColumnConfig[], mins: number[]): number[] {
  const defaults = columns.map((c) => c.defaultPercent)
  if (typeof window === 'undefined') return normalizeTo100(defaults, mins)

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}`)
    if (!raw) return normalizeTo100(defaults, mins)
    const parsed = JSON.parse(raw) as number[]
    if (!Array.isArray(parsed) || parsed.length !== columns.length) {
      return normalizeTo100(defaults, mins)
    }
    return normalizeTo100(parsed, mins)
  } catch {
    return normalizeTo100(defaults, mins)
  }
}

export function useResizableColumns(
  tableId: string,
  columns: ResizableColumnConfig[],
  tableRef: RefObject<HTMLTableElement | null>,
) {
  const mins = columns.map((c) => c.minPercent ?? 4)
  const [widths, setWidths] = useState<number[]>(() => loadWidths(tableId, columns, mins))
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null)
  const dragRef = useRef<{ index: number; startX: number; startWidths: number[] } | null>(null)

  const columnIds = columns.map((c) => c.id)

  const persistWidths = useCallback(
    (next: number[]) => {
      const normalized = normalizeTo100(next, mins)
      setWidths(normalized)
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${tableId}`, JSON.stringify(normalized))
      } catch {
        // ignore quota errors
      }
    },
    [mins, tableId],
  )

  const onResizeStart = useCallback(
    (columnId: string, clientX: number) => {
      const index = columnIds.indexOf(columnId)
      if (index < 0 || index >= columnIds.length - 1) return

      dragRef.current = { index, startX: clientX, startWidths: [...widths] }
      setResizingColumnId(columnId)
    },
    [columnIds, widths],
  )

  useEffect(() => {
    if (!resizingColumnId) return

    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current
      const table = tableRef.current
      if (!drag || !table) return

      const tableWidth = table.getBoundingClientRect().width
      if (tableWidth <= 0) return

      const deltaPercent = ((event.clientX - drag.startX) / tableWidth) * 100
      const next = [...drag.startWidths]
      const leftMin = mins[drag.index] ?? 4
      const rightMin = mins[drag.index + 1] ?? 4
      const maxLeft = next[drag.index] + next[drag.index + 1] - rightMin
      const newLeft = Math.max(leftMin, Math.min(next[drag.index] + deltaPercent, maxLeft))
      const actualDelta = newLeft - next[drag.index]

      next[drag.index] = newLeft
      next[drag.index + 1] -= actualDelta
      setWidths(normalizeTo100(next, mins))
    }

    const onMouseUp = () => {
      dragRef.current = null
      setResizingColumnId(null)
      setWidths((current) => {
        const normalized = normalizeTo100(current, mins)
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${tableId}`, JSON.stringify(normalized))
        } catch {
          // ignore
        }
        return normalized
      })
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [mins, resizingColumnId, tableId, tableRef])

  const widthsById = Object.fromEntries(columnIds.map((id, index) => [id, widths[index] ?? 0]))

  return {
    columnIds,
    widths: widthsById,
    resizingColumnId,
    onResizeStart,
    persistWidths,
  }
}
