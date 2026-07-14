import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SortDirection } from '../../lib/tableSort'

interface SortableTableHeadProps {
  label: string
  column: string
  sortKey: string | null
  direction: SortDirection
  onSort: (column: string) => void
  className?: string
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
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
}: SortableTableHeadProps) {
  if (!sortable) {
    return <th className={cn('font-medium', className)}>{label}</th>
  }

  const active = sortKey === column
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown

  return (
    <th className={cn('font-medium', className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-white transition-colors',
          align === 'right' && 'w-full justify-end',
          align === 'center' && 'w-full justify-center',
          active && 'text-white',
        )}
      >
        {label}
        <Icon size={14} className={cn('shrink-0', active ? 'opacity-100' : 'opacity-40')} />
      </button>
    </th>
  )
}
