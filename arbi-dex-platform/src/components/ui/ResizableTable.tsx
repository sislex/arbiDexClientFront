import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useResizableColumns, type ResizableColumnConfig } from '../../hooks/useResizableColumns'
import { cn } from '../../lib/utils'

export type { ResizableColumnConfig }

interface ResizableTableContextValue {
  onResizeStart: (columnId: string, e: React.MouseEvent) => void
  resizingColumnId: string | null
  isLastColumn: (columnId: string) => boolean
}

const ResizableTableContext = createContext<ResizableTableContextValue | null>(null)

export function useResizableTableContext() {
  return useContext(ResizableTableContext)
}

interface ResizableTableProps {
  tableId: string
  columns: ResizableColumnConfig[]
  className?: string
  children: ReactNode
}

export function ResizableTable({ tableId, columns, className, children }: ResizableTableProps) {
  const tableRef = useRef<HTMLTableElement>(null)
  const { widths, columnIds, onResizeStart, resizingColumnId } = useResizableColumns(
    tableId,
    columns,
    tableRef,
  )

  return (
    <ResizableTableContext.Provider
      value={{
        onResizeStart: (columnId, e) => {
          e.preventDefault()
          e.stopPropagation()
          onResizeStart(columnId, e.clientX)
        },
        resizingColumnId,
        isLastColumn: (columnId) => columnIds[columnIds.length - 1] === columnId,
      }}
    >
      <table ref={tableRef} className={cn('w-full table-fixed', className)}>
        <colgroup>
          {columnIds.map((id) => (
            <col key={id} style={{ width: `${widths[id]}%` }} />
          ))}
        </colgroup>
        {children}
      </table>
    </ResizableTableContext.Provider>
  )
}

interface TableHeadCellProps {
  columnId?: string
  className?: string
  children: ReactNode
  align?: 'left' | 'right' | 'center'
}

export function TableHeadCell({ columnId, className, children, align = 'left' }: TableHeadCellProps) {
  const ctx = useResizableTableContext()

  return (
    <th
      className={cn(
        'relative font-medium overflow-hidden',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
      {ctx && columnId && !ctx.isLastColumn(columnId) && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину колонки"
          onMouseDown={(e) => ctx.onResizeStart(columnId, e)}
          className={cn(
            'absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 touch-none',
            'hover:bg-accent-purple/45 active:bg-accent-purple/70',
            ctx.resizingColumnId === columnId && 'bg-accent-purple/70',
          )}
        />
      )}
    </th>
  )
}

/** Общие классы ячеек таблицы — без горизонтального скролла */
export const TABLE_CELL = 'px-3 py-2 min-w-0 overflow-hidden'
export const TABLE_HEAD = 'px-3 py-2.5'
export const TABLE_ACTIONS_CELL = 'px-2 py-2 shrink-0'
