import { cn } from '../../lib/utils'

interface UndoDeleteToastProps {
  message: string
  onCancel: () => void
}

export function UndoDeleteToast({ message, onCancel }: UndoDeleteToastProps) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        <p className="flex-1 min-w-0 text-sm text-white">{message}</p>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium',
            'bg-accent-purple/15 text-accent-purple hover:bg-accent-purple/25 transition-colors',
          )}
        >
          Отменить
        </button>
      </div>
    </div>
  )
}
