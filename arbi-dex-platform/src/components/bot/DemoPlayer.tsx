import { Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react'
import { cn } from '../../lib/utils'

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const

interface DemoPlayerProps {
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  speed: number
  onSpeedChange: (speed: number) => void
  currentPoint: number
  totalPoints: number
  currentTime: string
  progress: number
  onProgressChange: (progress: number) => void
}

export function DemoPlayer({
  playing,
  onPlayingChange,
  speed,
  onSpeedChange,
  currentPoint,
  totalPoints,
  currentTime,
  progress,
  onProgressChange,
}: DemoPlayerProps) {
  return (
    <div className="border-t border-border bg-surface/60 px-4 py-3 space-y-3 shrink-0">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Player</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onProgressChange(Math.max(0, progress - 0.01))}
            className="p-2 rounded-lg hover:bg-white/5 text-muted hover:text-white"
            title="Назад"
          >
            <SkipBack size={16} />
          </button>
          <button
            type="button"
            onClick={() => onPlayingChange(!playing)}
            className="p-2 rounded-lg bg-warning/15 text-warning hover:bg-warning/25"
            title={playing ? 'Пауза' : 'Воспроизведение'}
          >
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={() => {
              onPlayingChange(false)
              onProgressChange(0)
            }}
            className="p-2 rounded-lg hover:bg-white/5 text-muted hover:text-white"
            title="Стоп"
          >
            <Square size={16} />
          </button>
          <button
            type="button"
            onClick={() => onProgressChange(Math.min(1, progress + 0.01))}
            className="p-2 rounded-lg hover:bg-white/5 text-muted hover:text-white"
            title="Вперёд"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <span className="text-xs text-muted font-mono">
          Point {currentPoint.toLocaleString()} / {totalPoints.toLocaleString()} @ {currentTime}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              className={cn(
                'px-2 py-1 text-xs rounded-md border transition-colors',
                speed === s
                  ? 'border-warning bg-warning/15 text-warning font-semibold'
                  : 'border-border text-muted hover:text-white',
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-warning/60 via-success/40 to-accent-purple/40 rounded-full transition-all"
          style={{ width: `${progress * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => onProgressChange(Number(e.target.value) / 1000)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <p className="text-[10px] text-muted text-right">view {(progress * 100).toFixed(1)}%</p>
    </div>
  )
}
