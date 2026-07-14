import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useSimulatorI18n } from "./useSimulatorI18n";
import { EventExplainPanel } from "./EventExplainPanel";
import { StepResultPanel } from "./StepResultPanel";
import {
  MAX_RENDERED_LOG_EVENTS,
  SIMULATION_EVENT_TYPE_CONFIG,
  type SimulationEventType,
  type SimulationLogEvent,
} from "./simulationViewerTypes";

export interface SimulationSidebarProps {
  events: SimulationLogEvent[];
  stepResult: SimulationLogEvent | null;
  playIdx: number;
  timelineLastTs: number;
  loading?: boolean;
  isDark?: boolean;
  token1Label?: string;
  token2Label?: string;
  width?: number;
  collapsed?: boolean;
  onWidthChange?: (width: number) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  onJumpToEvent?: (event: SimulationLogEvent) => void;
}

export function SimulationSidebar({
  events,
  stepResult,
  playIdx,
  timelineLastTs,
  loading = false,
  isDark = true,
  token1Label = "Token1",
  token2Label = "Token2",
  width = 280,
  collapsed = false,
  onWidthChange,
  onCollapsedChange,
  onJumpToEvent,
}: SimulationSidebarProps) {
  const { t } = useSimulatorI18n();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<SimulationEventType>>(
    () => new Set(Object.keys(SIMULATION_EVENT_TYPE_CONFIG) as SimulationEventType[]),
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [logClearedAtTs, setLogClearedAtTs] = useState(-1);
  const [useSharedScroll, setUseSharedScroll] = useState(false);
  const [sharedLogMaxHeight, setSharedLogMaxHeight] = useState(0);

  const filterRef = useRef<HTMLDivElement>(null);
  const logListRef = useRef<HTMLDivElement>(null);
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const stepSectionRef = useRef<HTMLDivElement>(null);
  const controlsSectionRef = useRef<HTMLDivElement>(null);
  const logPrevMetricsRef = useRef({ length: 0, scrollHeight: 0 });

  const borderColor = isDark ? "#1E2D40" : "#D1D9E0";
  const textPrimary = isDark ? "#E8EDF2" : "#0F1923";
  const textSecondary = isDark ? "#6B7A8D" : "#5A6A7A";
  const textTertiary = isDark ? "#C4CDD8" : "#374151";
  const panelBg = isDark ? "#111722" : "#FFFFFF";
  const surfaceBg = isDark ? "#0D1520" : "#F5F7FA";
  const accent = isDark ? "#F5C400" : "#D4A900";

  const allTypes = Object.keys(SIMULATION_EVENT_TYPE_CONFIG) as SimulationEventType[];

  const { visibleEvents, totalEventsAfterClear } = useMemo(() => {
    const filtered: SimulationLogEvent[] = [];
    let total = 0;
    for (const event of events) {
      if (event.dataIdx <= playIdx && event.dataIdx >= 0) {
        total += 1;
        const eventTs = event.markerTs ?? -1;
        if (eventTs > logClearedAtTs && activeTypes.has(event.type)) {
          filtered.push(event);
        }
      }
    }
    return { visibleEvents: filtered, totalEventsAfterClear: total };
  }, [events, playIdx, logClearedAtTs, activeTypes]);

  const renderedEvents = useMemo(
    () => [...visibleEvents].reverse().slice(0, MAX_RENDERED_LOG_EVENTS),
    [visibleEvents],
  );

  useLayoutEffect(() => {
    const el = useSharedScroll ? panelScrollRef.current : logListRef.current;
    if (!el) return;
    const prev = logPrevMetricsRef.current;
    const nextLength = renderedEvents.length;
    const nextHeight = el.scrollHeight;
    if (nextLength > prev.length) {
      const delta = nextHeight - prev.scrollHeight;
      const isNearTop = el.scrollTop <= 8;
      if (!isNearTop && delta > 0) el.scrollTop += delta;
    }
    logPrevMetricsRef.current = { length: nextLength, scrollHeight: nextHeight };
  }, [renderedEvents, useSharedScroll]);

  useEffect(() => {
    const panel = panelScrollRef.current;
    if (!panel || collapsed) {
      setUseSharedScroll(false);
      setSharedLogMaxHeight(0);
      return;
    }
    const calcMode = () => {
      const panelH = panel.clientHeight;
      const headerH = headerRef.current?.offsetHeight ?? 0;
      const stepH = stepSectionRef.current?.offsetHeight ?? 0;
      const controlsH = controlsSectionRef.current?.offsetHeight ?? 0;
      if (panelH <= 0) return;
      const logAreaH = Math.max(0, panelH - headerH - stepH - controlsH);
      setSharedLogMaxHeight(Math.max(120, Math.floor(panelH * 0.5)));
      setUseSharedScroll((logAreaH / panelH) < 0.5);
    };
    calcMode();
    const observer = new ResizeObserver(calcMode);
    observer.observe(panel);
    if (headerRef.current) observer.observe(headerRef.current);
    if (stepSectionRef.current) observer.observe(stepSectionRef.current);
    if (controlsSectionRef.current) observer.observe(controlsSectionRef.current);
    window.addEventListener("resize", calcMode);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", calcMode);
    };
  }, [collapsed, renderedEvents.length, width]);

  useEffect(() => {
    if (!filterOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [filterOpen]);

  const toggleType = (type: SimulationEventType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div
      ref={panelScrollRef}
      className="flex flex-col shrink-0 relative h-full"
      style={{
        width: collapsed ? "36px" : `${width}px`,
        borderLeft: `1px solid ${borderColor}`,
        overflowY: useSharedScroll && !collapsed ? "auto" : "visible",
        scrollbarWidth: "none",
      }}
    >
      {!collapsed && onWidthChange && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-20"
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startW = width;
            const onMove = (ev: MouseEvent) => {
              onWidthChange(Math.max(220, Math.min(480, startW + (startX - ev.clientX))));
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

      <div ref={headerRef} className="px-2.5 py-2 shrink-0" style={{ borderBottom: `1px solid ${borderColor}` }}>
        <div className="flex items-center justify-between gap-2">
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: textPrimary,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
              display: collapsed ? "none" : "inline",
            }}
          >
            Анализ текущего шага
          </span>
          {onCollapsedChange && (
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ border: `1px solid ${borderColor}`, color: textSecondary }}
              title={collapsed ? "Открыть лог" : "Скрыть лог"}
            >
              {collapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div ref={stepSectionRef} className="shrink-0" style={{ borderBottom: `1px solid ${borderColor}` }}>
          <StepResultPanel
            event={stepResult}
            isDark={isDark}
            token1Label={token1Label}
            token2Label={token2Label}
          />
        </div>
      )}

      {!collapsed && (
        <div ref={controlsSectionRef} className="px-2.5 py-2 shrink-0" style={{ borderBottom: `1px solid ${borderColor}` }}>
          <div className="flex items-center justify-between gap-2">
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: textPrimary,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              {t("simulator.events")}
            </span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "10px", color: textSecondary, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                {visibleEvents.length} / {totalEventsAfterClear}
              </span>
              {visibleEvents.length > renderedEvents.length && (
                <span style={{ fontSize: "10px", color: textSecondary, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                  (последние {renderedEvents.length})
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => {
                setLogClearedAtTs(timelineLastTs);
                setExpandedEvent(null);
              }}
              className="px-2 py-1 rounded text-xs transition-colors shrink-0"
              style={{ border: `1px solid ${borderColor}`, color: textSecondary, fontFamily: "var(--font-mono)" }}
            >
              Очистить лог
            </button>
            <div className="relative flex-1 min-w-0" ref={filterRef}>
              <button
                type="button"
                onClick={() => setFilterOpen((o) => !o)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                style={{
                  border: `1px solid ${activeTypes.size < allTypes.length ? accent : borderColor}`,
                  backgroundColor: activeTypes.size < allTypes.length ? `${accent}10` : "transparent",
                  color: activeTypes.size < allTypes.length ? accent : textSecondary,
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span style={{ fontSize: "10px" }}>Filter</span>
                {activeTypes.size < allTypes.length && (
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center ml-0.5"
                    style={{
                      backgroundColor: accent,
                      color: isDark ? "#070B11" : "#fff",
                      fontSize: "9px",
                      fontWeight: 700,
                    }}
                  >
                    {activeTypes.size}
                  </span>
                )}
              </button>
              {filterOpen && (
                <div
                  className="absolute right-0 top-8 z-50 rounded py-1.5 min-w-44"
                  style={{
                    backgroundColor: panelBg,
                    border: `1px solid ${borderColor}`,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-3 pb-1.5 mb-1"
                    style={{ borderBottom: `1px solid ${borderColor}` }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        color: textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      Event types
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTypes(
                          activeTypes.size === allTypes.length ? new Set() : new Set(allTypes),
                        )
                      }
                      style={{ fontSize: "10px", color: accent }}
                    >
                      {activeTypes.size === allTypes.length ? "None" : "All"}
                    </button>
                  </div>
                  {allTypes.map((type) => {
                    const cfg = SIMULATION_EVENT_TYPE_CONFIG[type];
                    const active = activeTypes.has(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleType(type)}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors"
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = isDark
                            ? "#1A2333"
                            : "#F0F2F5";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                        }}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-sm shrink-0 flex items-center justify-center"
                          style={{
                            border: `1px solid ${active ? cfg.color : borderColor}`,
                            backgroundColor: active ? `${cfg.color}20` : "transparent",
                          }}
                        >
                          {active && (
                            <span style={{ fontSize: "9px", color: cfg.color, fontWeight: 700, lineHeight: 1 }}>
                              ✓
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            color: cfg.color,
                            minWidth: "28px",
                          }}
                        >
                          {cfg.label}
                        </span>
                        <span style={{ fontSize: "11px", color: textTertiary }}>{type}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!collapsed && (
        <div
          ref={logListRef}
          className={useSharedScroll ? "shrink-0" : "flex-1 overflow-y-auto"}
          style={{
            scrollbarWidth: "none",
            overflowY: "auto",
            maxHeight: useSharedScroll ? `${sharedLogMaxHeight}px` : undefined,
          }}
        >
          {renderedEvents.map((event) => {
            const cfg = SIMULATION_EVENT_TYPE_CONFIG[event.type];
            const isExpanded = expandedEvent === event.id;
            const hasDetail = !!event.detail;
            return (
              <div key={event.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                <div
                  className="px-3 py-2 flex items-start gap-2.5 transition-colors cursor-pointer"
                  style={{ backgroundColor: isExpanded ? surfaceBg : "transparent" }}
                  onClick={() => {
                    if (hasDetail) setExpandedEvent(isExpanded ? null : event.id);
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) (e.currentTarget as HTMLDivElement).style.backgroundColor = surfaceBg;
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      color: textSecondary,
                      fontFamily: "var(--font-mono)",
                      minWidth: "32px",
                      paddingTop: "1px",
                    }}
                  >
                    {event.time}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      color: cfg.color,
                      minWidth: "28px",
                      paddingTop: "2px",
                    }}
                  >
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: "11px", color: textTertiary, flex: 1, lineHeight: "1.4" }}>
                    {event.message}
                  </span>
                  {hasDetail && (
                    <span style={{ color: textSecondary, paddingTop: "2px" }}>
                      {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </span>
                  )}
                </div>
                {isExpanded && event.detail && (
                  <div className="px-3 pb-3">
                    <EventExplainPanel
                      event={event}
                      onClose={() => setExpandedEvent(null)}
                      onJumpToPoint={onJumpToEvent ? () => onJumpToEvent(event) : undefined}
                      isDark={isDark}
                      token1Label={token1Label}
                      token2Label={token2Label}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {renderedEvents.length === 0 && (
            <div className="px-3 py-4 text-xs" style={{ color: textSecondary }}>
              {loading ? "Loading…" : "Press play or move the slider."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
