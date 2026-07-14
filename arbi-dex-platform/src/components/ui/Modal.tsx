import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  if (!open) return null

  const sizes = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative w-full rounded-[var(--radius-xl)] bg-card border border-border shadow-2xl',
          sizes[size],
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

interface StepperProps {
  steps: string[]
  current: number
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                i < current
                  ? 'bg-accent-purple text-white'
                  : i === current
                    ? 'bg-accent-purple/20 text-accent-purple border-2 border-accent-purple'
                    : 'bg-surface text-muted border border-border',
              )}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span
              className={cn(
                'text-sm font-medium hidden sm:block',
                i <= current ? 'text-white' : 'text-muted',
              )}
            >
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'flex-1 h-px mx-3',
                i < current ? 'bg-accent-purple' : 'bg-border',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function ModalFooter({
  onCancel,
  onConfirm,
  confirmLabel = 'Далее',
  cancelLabel = 'Отмена',
  loading,
  confirmDisabled,
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  confirmDisabled?: boolean
}) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button onClick={onConfirm} disabled={loading || confirmDisabled}>
        {confirmLabel}
      </Button>
    </>
  )
}
