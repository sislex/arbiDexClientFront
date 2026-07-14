import { cn } from '../../lib/utils'

type BadgeVariant = 'success' | 'warning' | 'error' | 'default' | 'purple' | 'cyan'

const variants: Record<BadgeVariant, string> = {
  success: 'bg-success/15 text-success border-success/20',
  warning: 'bg-warning/15 text-warning border-warning/20',
  error: 'bg-error/15 text-error border-error/20',
  default: 'bg-white/5 text-slate-400 border-white/10',
  purple: 'bg-accent-purple/15 text-accent-purple border-accent-purple/20',
  cyan: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/20',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    active: 'success',
    running: 'success',
    paused: 'warning',
    stopped: 'error',
    inactive: 'default',
  }
  const labels: Record<string, string> = {
    active: 'Активен',
    running: 'Работает',
    paused: 'Пауза',
    stopped: 'Остановлен',
    inactive: 'Неактивен',
  }
  return <Badge variant={map[status] ?? 'default'}>{labels[status] ?? status}</Badge>
}
