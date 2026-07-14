import { ChevronDown, ChevronUp, Pause, Play, SkipBack, SkipForward, Square } from "lucide-react";
import {
  DEFAULT_PLAYBACK_INTERVAL_MS,
  PLAYBACK_SPEEDS,
  type SimulationLogEvent,
} from "./simulationViewerTypes";

function PlayerBtn({
  children,
  onClick,
  title,
  isDark,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  isDark: boolean;
}) {
  const border = isDark ? "#1E2D40" : "#D1D9E0";
  const color = isDark ? "#6B7A8D" : "#5A6A7A";
  return (
    <button
      onClick={onClick}
      title={title}
      type="button"
      className="w-7 h-7 flex items-center justify-center rounded transition-colors"
      style={{ border: `1px solid ${border}`, color, backgroundColor: "transparent" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = isDark ? "#E8EDF2" : "#0F1923";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = color;
      }}
    >
      {children}
    </button>
  );
}

export interface SimulationPlayerProps {
  playIdx: number;
  maxIdx: number;
  currentLabel?: string;
  isPlaying: boolean;
  speed: number;
  events: SimulationLogEvent[];
  loading?: boolean;
  isDark?: boolean;
  collapsed?: boolean;
  height?: number;
  accent?: string;
  onPlayIdxChange: (idx: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  onHeightChange?: (height: number) => void;
}

export function SimulationPlayer({
  playIdx,
  maxIdx,
  currentLabel,
  isPlaying,
  speed,
  events,
  loading = false,
  isDark = true,
  collapsed = false,
  height = 128,
  accent = isDark ? "#F5C400" : "#D4A900",
  onPlayIdxChange,
  onPlayingChange,
  onSpeedChange,
  onCollapsedChange,
  onHeightChange,
}: SimulationPlayerProps) {
  const borderColor = isDark ? "#1E2D40" : "#D1D9E0";
  const textPrimary = isDark ? "#E8EDF2" : "#0F1923";
  const textSecondary = isDark ? "#6B7A8D" : "#5A6A7A";
  const surfaceBg = isDark ? "#0D1520" : "#F5F7FA";
  const inputBg = isDark ? "#1A2333" : "#E8ECF0";

  const goToPrevEvent = () => {
    const prev = [...events].reverse().find((e) => e.dataIdx < playIdx && e.dataIdx > 0);
    if (prev) onPlayIdxChange(prev.dataIdx);
  };

  const goToNextEvent = () => {
    const next = events.find((e) => e.dataIdx > playIdx);
    if (next) onPlayIdxChange(next.dataIdx);
  };

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{
        borderTop: `1px solid ${borderColor}`,
        backgroundColor: surfaceBg,
        height: collapsed ? 34 : height,
      }}
    >
      {onHeightChange && (
        <div
          className="h-1 cursor-row-resize"
          onMouseDown={(e) => {
            const startY = e.clientY;
            const startH = height;
            const onMove = (ev: MouseEvent) => {
              onHeightChange(Math.max(80, Math.min(280, startH + (startY - ev.clientY))));
            };
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        />
      )}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderBottom: collapsed ? "none" : `1px solid ${borderColor}` }}
      >
        <span
          style={{
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: textSecondary,
            fontFamily: "var(--font-mono)",
          }}
        >
          Player
        </span>
        {onCollapsedChange && (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ border: `1px solid ${borderColor}`, color: textSecondary }}
          >
            {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="px-4 py-3 flex-1 overflow-hidden">
          <div className="flex items-center gap-3 mb-2.5 flex-wrap">
            <div className="flex items-center gap-1">
              <PlayerBtn onClick={goToPrevEvent} title="Previous Event" isDark={isDark}>
                <SkipBack size={12} />
              </PlayerBtn>
              <button
                type="button"
                onClick={() => onPlayingChange(!isPlaying)}
                disabled={loading}
                className="w-7 h-7 flex items-center justify-center rounded transition-colors"
                style={{
                  backgroundColor: accent,
                  color: isDark ? "#070B11" : "#ffffff",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <PlayerBtn onClick={goToNextEvent} title="Next Event" isDark={isDark}>
                <SkipForward size={12} />
              </PlayerBtn>
              <PlayerBtn
                onClick={() => {
                  onPlayIdxChange(0);
                  onPlayingChange(false);
                }}
                title="Reset"
                isDark={isDark}
              >
                <Square size={11} />
              </PlayerBtn>
            </div>

            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: "10px", color: textSecondary, fontFamily: "var(--font-mono)" }}>Point</span>
              <span
                style={{
                  fontSize: "12px",
                  color: textPrimary,
                  fontFamily: "var(--font-mono)",
                  minWidth: "90px",
                }}
              >
                {Math.min(playIdx, maxIdx).toLocaleString()} / {maxIdx.toLocaleString()}
              </span>
              {currentLabel && (
                <span style={{ fontSize: "10px", color: textSecondary, fontFamily: "var(--font-mono)" }}>
                  @ {currentLabel}
                </span>
              )}
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-1">
              <span
                style={{
                  fontSize: "10px",
                  color: textSecondary,
                  fontFamily: "var(--font-mono)",
                  marginRight: "4px",
                }}
              >
                Speed
              </span>
              {PLAYBACK_SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSpeedChange(s)}
                  className="px-2 py-1 rounded text-xs transition-colors"
                  style={{
                    fontFamily: "var(--font-mono)",
                    backgroundColor: speed === s ? `${accent}20` : "transparent",
                    border: `1px solid ${speed === s ? `${accent}50` : borderColor}`,
                    color: speed === s ? accent : textSecondary,
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span style={{ fontSize: "9px", color: textSecondary, fontFamily: "var(--font-mono)" }}>0</span>
            <div className="relative flex-1 h-1.5 rounded-full" style={{ backgroundColor: inputBg }}>
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-none"
                style={{
                  width: `${maxIdx > 0 ? (playIdx / maxIdx) * 100 : 0}%`,
                  backgroundColor: accent,
                }}
              />
              <input
                type="range"
                min={0}
                max={maxIdx}
                step={1}
                value={playIdx}
                onChange={(e) => {
                  onPlayIdxChange(Number(e.target.value));
                  onPlayingChange(false);
                }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
              />
              {events
                .filter((e) => e.type === "Buy" || e.type === "Sell" || e.type === "Error")
                .map((ev, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
                    style={{
                      left: `${maxIdx > 0 ? (ev.dataIdx / maxIdx) * 100 : 0}%`,
                      backgroundColor:
                        ev.type === "Buy" ? "#10B981" : ev.type === "Sell" ? "#E5383B" : "#EAB308",
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                ))}
            </div>
            <span style={{ fontSize: "9px", color: textSecondary, fontFamily: "var(--font-mono)" }}>
              {maxIdx}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_PLAYBACK_INTERVAL_MS };
