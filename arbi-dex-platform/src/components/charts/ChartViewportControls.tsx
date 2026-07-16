import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ChartViewportControlsProps {
  onZoomOut: () => void
  onZoomIn: () => void
  onPanLeft: () => void
  onPanRight: () => void
  onToggleFullscreen: () => void
  isFullscreen?: boolean
  className?: string
  /** Inline panel style for dark simulation workspace */
  variant?: 'default' | 'simulation'
  panelBg?: string
  borderColor?: string
  textSecondary?: string
}

export function ChartViewportControls({
  onZoomOut,
  onZoomIn,
  onPanLeft,
  onPanRight,
  onToggleFullscreen,
  isFullscreen = false,
  className,
  variant = 'default',
  panelBg,
  borderColor,
  textSecondary,
}: ChartViewportControlsProps) {
  if (variant === 'simulation') {
    const bg = panelBg ?? '#111722'
    const border = borderColor ?? 'rgba(255,255,255,0.08)'
    const color = textSecondary ?? '#94A3B8'
    const btnStyle = {
      backgroundColor: bg,
      border: `1px solid ${border}`,
      color,
    }

    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <button
          type="button"
          onClick={onZoomOut}
          className="w-7 h-7 rounded text-sm flex items-center justify-center"
          style={btnStyle}
        >
          -
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          className="w-7 h-7 rounded text-sm flex items-center justify-center"
          style={btnStyle}
        >
          +
        </button>
        <div
          className="flex items-center rounded overflow-hidden"
          style={{ backgroundColor: bg, border: `1px solid ${border}` }}
        >
          <button
            type="button"
            onClick={onPanLeft}
            className="w-7 h-7 flex items-center justify-center"
            style={{ color, borderRight: `1px solid ${border}` }}
          >
            <ChevronLeft size={12} />
          </button>
          <button
            type="button"
            onClick={onPanRight}
            className="w-7 h-7 flex items-center justify-center"
            style={{ color }}
          >
            <ChevronRight size={12} />
          </button>
        </div>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="w-7 h-7 rounded flex items-center justify-center"
          style={btnStyle}
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <button
        type="button"
        onClick={onZoomOut}
        className="w-7 h-7 rounded text-sm flex items-center justify-center border border-border bg-surface/80 text-muted hover:text-white hover:bg-white/5"
      >
        -
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        className="w-7 h-7 rounded text-sm flex items-center justify-center border border-border bg-surface/80 text-muted hover:text-white hover:bg-white/5"
      >
        +
      </button>
      <div className="flex items-center rounded overflow-hidden border border-border bg-surface/80">
        <button
          type="button"
          onClick={onPanLeft}
          className="w-7 h-7 flex items-center justify-center text-muted hover:text-white hover:bg-white/5 border-r border-border"
        >
          <ChevronLeft size={12} />
        </button>
        <button
          type="button"
          onClick={onPanRight}
          className="w-7 h-7 flex items-center justify-center text-muted hover:text-white hover:bg-white/5"
        >
          <ChevronRight size={12} />
        </button>
      </div>
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="w-7 h-7 rounded flex items-center justify-center border border-border bg-surface/80 text-muted hover:text-white hover:bg-white/5"
      >
        {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
      </button>
    </div>
  )
}
