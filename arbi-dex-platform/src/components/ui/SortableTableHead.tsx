import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SortDirection } from '../../lib/tableSort'
import { useResizableTableContext } from './ResizableTable'

interface SortableTableHeadProps {
  label: string
  column: string
  sortKey: string | null
  direction: SortDirection
  onSort: (column: string) => void
  className?: string
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  /** Id колонки для ResizableTable */
  columnId?: string
}

export function SortableTableHead({
  label,
  column,
  sortKey,
  direction,
  onSort,
  className,
  align = 'left',
  sortable = true,
  columnId,
}: SortableTableHeadProps) {
  const resizeCtx = useResizableTableContext()
  const resizeId = columnId ?? column

  if (!sortable) {
    return (
      <th className={cn('relative font-medium overflow-hidden', className)}>
        {label}
        {resizeCtx && !resizeCtx.isLastColumn(resizeId) && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Изменить ширину колонки"
            onMouseDown={(e) => resizeCtx.onResizeStart(resizeId, e)}
            className={cn(
              'absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 touch-none',
              'hover:bg-accent-purple/45 active:bg-accent-purple/70',
              resizeCtx.resizingColumnId === resizeId && 'bg-accent-purple/70',
            )}
          />
        )}
      </th>
    )
  }

  const active = sortKey === column
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown

  return (
    <th className={cn('relative font-medium overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 max-w-full hover:text-white transition-colors truncate',
          align === 'right' && 'w-full justify-end',
          align === 'center' && 'w-full justify-center',
          active && 'text-white',
        )}
      >
        <span className="truncate">{label}</span>
        <Icon size={13} className={cn('shrink-0', active ? 'opacity-100' : 'opacity-40')} />
      </button>
      {resizeCtx && !resizeCtx.isLastColumn(resizeId) && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину колонки"
          onMouseDown={(e) => resizeCtx.onResizeStart(resizeId, e)}
          className={cn(
            'absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 touch-none',
            'hover:bg-accent-purple/45 active:bg-accent-purple/70',
            resizeCtx.resizingColumnId === resizeId && 'bg-accent-purple/70',
          )}
        />
      )}
    </th>
  )
}
