import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
  type WheelEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { AgCharts } from "ag-charts-react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Square,
  Loader2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useSimulatorI18n } from "./useSimulatorI18n";
import { ChartErrorBoundary } from "./ChartErrorBoundary";
import { PlayerBtn } from "./PlayerBtn";
import { StepResultPanel } from "./StepResultPanel";
import { EventExplainPanel } from "./EventExplainPanel";
import {
  chartCrosshairDateTime,
  chartDateTime,
  chartTimeOnly,
} from "./simulationFormatters";
import {
  DEFAULT_PLAYBACK_INTERVAL_MS,
  MAX_RENDERED_LOG_EVENTS,
  PLAYBACK_SPEEDS,
  SIMULATION_EVENT_TYPE_CONFIG,
  type SimulationChartPoint,
  type SimulationEventType,
  type SimulationLogEvent,
} from "./simulationViewerTypes";

export interface SimulationWorkspaceHeader {
  pairLabel: string;
  networksLabel: string;
  lastPrice?: string;
  live?: boolean;
  id?: string;
  status?: string;
  rules?: number | string;
  profitCurrency?: string;
  badge?: React.ReactNode;
}

export interface StrategySimulationWorkspaceProps {
  chartData: SimulationChartPoint[];
  events: SimulationLogEvent[];
  stepResult: SimulationLogEvent | null;
  networks: Array<{ id: string; label: string; color: string }>;
  tradingNetworkIds: Set<string> | string[];
  playIdx: number;
  onPlayIdxChange: (idx: number) => void;
  isPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  speed?: number;
  onSpeedChange?: (speed: number) => void;
  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  isDark?: boolean;
  token1Label?: string;
  token2Label?: string;
  header: SimulationWorkspaceHeader;
  className?: string;
}

type VisKey = string;
type TradeEventHint = { type: "Buy" | "Sell" | "Error" };
type NavigatorDragMode = "window" | "start" | "end";

interface HoverCrosshair {
  xPx: number;
  yPx: number;
  ts: number;
  price: number;
  avg?: number;
  buy?: number;
  sell?: number;
  tradeType?: "Buy" | "Sell" | "Error";
}

const CHART_PLOT_PADDING = { top: 8, right: 16, bottom: 8, left: 8 };
const MIN_ZOOM_POINTS = 2;
const EVENT_LOG_ROW_HEIGHT_PX = 44;
const EVENT_LOG_MIN_VISIBLE_ROWS = 5;
const EVENT_LOG_MIN_HEIGHT_PX = EVENT_LOG_ROW_HEIGHT_PX * EVENT_LOG_MIN_VISIBLE_ROWS;
const STEP_RESULT_MIN_HEIGHT_PX = 80;
const STEP_RESULT_DEFAULT_HEIGHT_PX = 192;
const PLAYER_MIN_HEIGHT_PX = 92;
const PLAYER_MAX_HEIGHT_PX = 360;

function toTradingNetworkSet(ids: Set<string> | string[]): Set<string> {
  return ids instanceof Set ? ids : new Set(ids);
}

export function StrategySimulationWorkspace({
  chartData,
  events,
  stepResult,
  networks,
  tradingNetworkIds: tradingNetworkIdsProp,
  playIdx,
  onPlayIdxChange,
  isPlaying: isPlayingProp,
  onPlayingChange,
  speed: speedProp,
  onSpeedChange,
  loading = false,
  loadingMessage = "Loading historical data…",
  error = null,
  isDark = true,
  token1Label = "token1",
  token2Label = "token2",
  header,
  className,
}: StrategySimulationWorkspaceProps) {
  const { t } = useSimulatorI18n();
  const tradingNetworkIds = useMemo(
    () => toTradingNetworkSet(tradingNetworkIdsProp),
    [tradingNetworkIdsProp],
  );

  const [internalPlaying, setInternalPlaying] = useState(false);
  const [internalSpeed, setInternalSpeed] = useState(1);
  const isPlayingControlled = isPlayingProp !== undefined;
  void isPlayingControlled;
  const speedControlled = speedProp !== undefined;
  void speedControlled;
  const isPlaying = isPlayingProp ?? internalPlaying;
  const speed = speedProp ?? internalSpeed;

  const setIsPlaying = useCallback(
    (playing: boolean) => {
      if (onPlayingChange) onPlayingChange(playing);
      else setInternalPlaying(playing);
    },
    [onPlayingChange],
  );

  const setSpeed = useCallback(
    (next: number) => {
      if (onSpeedChange) onSpeedChange(next);
      else setInternalSpeed(next);
    },
    [onSpeedChange],
  );

  const [visibility, setVisibility] = useState<Record<VisKey, boolean>>({ avg: true });
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<SimulationEventType>>(
    new Set(Object.keys(SIMULATION_EVENT_TYPE_CONFIG) as SimulationEventType[]),
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [logClearedAtTs, setLogClearedAtTs] = useState<number>(-1);
  const [zoomWindow, setZoomWindow] = useState<{ start: number; size: number } | null>(null);
  const [eventPanelWidth, setEventPanelWidth] = useState(280);
  const [eventPanelCollapsed, setEventPanelCollapsed] = useState(false);
  const [playerPanelHeight, setPlayerPanelHeight] = useState(128);
  const [playerPanelCollapsed, setPlayerPanelCollapsed] = useState(false);
  const [stepResultHeight, setStepResultHeight] = useState(STEP_RESULT_DEFAULT_HEIGHT_PX);
  const [resizingEventPanel, setResizingEventPanel] = useState(false);
  const [resizingPlayerPanel, setResizingPlayerPanel] = useState(false);
  const [resizingStepSection, setResizingStepSection] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartSafeMode, setChartSafeMode] = useState(false);
  const [chartErrorMessage, setChartErrorMessage] = useState<string | null>(null);
  const [isChartDragging, setIsChartDragging] = useState(false);
  const [isNavigatorDragging, setIsNavigatorDragging] = useState(false);
  const [hoverCrosshair, setHoverCrosshair] = useState<HoverCrosshair | null>(null);

  const filterRef = useRef<HTMLDivElement>(null);
  const logListRef = useRef<HTMLDivElement>(null);
  const eventPanelScrollRef = useRef<HTMLDivElement>(null);
  const eventPanelHeaderRef = useRef<HTMLDivElement>(null);
  const stepResultSectionRef = useRef<HTMLDivElement>(null);
  const eventsControlsSectionRef = useRef<HTMLDivElement>(null);
  const chartPanelRef = useRef<HTMLDivElement>(null);
  const chartNavigatorRef = useRef<HTMLDivElement>(null);
  const logPrevMetricsRef = useRef<{ length: number; scrollHeight: number }>({ length: 0, scrollHeight: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playIdxRef = useRef(playIdx);
  const eventResizeStartXRef = useRef(0);
  const eventResizeStartWidthRef = useRef(280);
  const playerResizeStartYRef = useRef(0);
  const playerResizeStartHeightRef = useRef(128);
  const stepResizeStartYRef = useRef(0);
  const stepResizeStartHeightRef = useRef(STEP_RESULT_DEFAULT_HEIGHT_PX);
  const chartDragStartXRef = useRef(0);
  const chartDragStartWindowRef = useRef<{ start: number; size: number } | null>(null);
  const navigatorDragStartXRef = useRef(0);
  const navigatorDragModeRef = useRef<NavigatorDragMode | null>(null);
  const navigatorDragStartWindowRef = useRef<{ start: number; size: number; total: number } | null>(null);

  playIdxRef.current = playIdx;

  useEffect(() => {
    setVisibility((prev) => {
      const next: Record<string, boolean> = { avg: prev.avg ?? true };
      for (const net of networks) {
        const isTrading = tradingNetworkIds.has(net.id);
        next[`${net.id}_buy`] = prev[`${net.id}_buy`] ?? isTrading;
        next[`${net.id}_sell`] = prev[`${net.id}_sell`] ?? isTrading;
        if (next.avg && !isTrading) {
          next[`${net.id}_buy`] = false;
          next[`${net.id}_sell`] = false;
        }
      }
      const anyPriceVisible = networks.some((net) => next[`${net.id}_buy`] || next[`${net.id}_sell`]);
      if (!next.avg && !anyPriceVisible) next.avg = true;
      return next;
    });
  }, [networks, tradingNetworkIds]);

  useEffect(() => {
    if (isPlayingControlled) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying && chartData.length > 0) {
      const delay = Math.max(16, Math.round(DEFAULT_PLAYBACK_INTERVAL_MS / Math.max(speed, 0.01)));
      intervalRef.current = setInterval(() => {
        const i = playIdxRef.current;
        if (i >= chartData.length) {
          setIsPlaying(false);
          return;
        }
        onPlayIdxChange(Math.min(i + 1, chartData.length));
      }, delay);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlayingControlled, isPlaying, speed, chartData.length, onPlayIdxChange, setIsPlaying]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === chartPanelRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!resizingEventPanel) return;
    const onMove = (e: MouseEvent) => {
      const delta = eventResizeStartXRef.current - e.clientX;
      const next = Math.max(210, Math.min(640, eventResizeStartWidthRef.current + delta));
      setEventPanelWidth(next);
    };
    const onUp = () => setResizingEventPanel(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingEventPanel]);

  useEffect(() => {
    if (!resizingPlayerPanel) return;
    const onMove = (e: MouseEvent) => {
      const delta = playerResizeStartYRef.current - e.clientY;
      const next = Math.max(
        PLAYER_MIN_HEIGHT_PX,
        Math.min(PLAYER_MAX_HEIGHT_PX, playerResizeStartHeightRef.current + delta),
      );
      setPlayerPanelHeight(next);
    };
    const onUp = () => setResizingPlayerPanel(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingPlayerPanel]);

  useEffect(() => {
    if (!resizingStepSection) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - stepResizeStartYRef.current;
      const panelH = eventPanelScrollRef.current?.clientHeight ?? 600;
      const headerH = eventPanelHeaderRef.current?.offsetHeight ?? 40;
      const controlsH = eventsControlsSectionRef.current?.offsetHeight ?? 100;
      const maxStep = Math.max(
        STEP_RESULT_MIN_HEIGHT_PX,
        panelH - headerH - controlsH - EVENT_LOG_MIN_HEIGHT_PX - 8,
      );
      const next = Math.max(
        STEP_RESULT_MIN_HEIGHT_PX,
        Math.min(maxStep, stepResizeStartHeightRef.current + delta),
      );
      setStepResultHeight(next);
    };
    const onUp = () => setResizingStepSection(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingStepSection]);

  useEffect(() => {
    const panel = eventPanelScrollRef.current;
    if (!panel || eventPanelCollapsed) return;
    const clampStepHeight = () => {
      const panelH = panel.clientHeight;
      const headerH = eventPanelHeaderRef.current?.offsetHeight ?? 40;
      const controlsH = eventsControlsSectionRef.current?.offsetHeight ?? 100;
      const maxStep = Math.max(
        STEP_RESULT_MIN_HEIGHT_PX,
        panelH - headerH - controlsH - EVENT_LOG_MIN_HEIGHT_PX - 8,
      );
      setStepResultHeight((h) => Math.min(h, maxStep));
    };
    clampStepHeight();
    const observer = new ResizeObserver(clampStepHeight);
    observer.observe(panel);
    if (eventsControlsSectionRef.current) observer.observe(eventsControlsSectionRef.current);
    return () => observer.disconnect();
  }, [eventPanelCollapsed, eventPanelWidth]);

  const timelineData = chartData.slice(0, Math.max(playIdx, 1));
  const zoomStart = zoomWindow?.start ?? 0;
  const zoomSize = zoomWindow?.size ?? timelineData.length;
  const zoomEnd = Math.min(zoomStart + zoomSize, timelineData.length);
  const visibleData = timelineData.slice(zoomStart, zoomEnd);
  const timelinePoints = Math.max(1, timelineData.length);
  const navigatorWindow = zoomWindow ?? { start: 0, size: timelinePoints };
  const navigatorStartPct = (navigatorWindow.start / timelinePoints) * 100;
  const navigatorSizePct = Math.max((navigatorWindow.size / timelinePoints) * 100, 2);
  const maxIdx = chartData.length;
  const isZoomed = zoomWindow !== null && timelineData.length > 0 && zoomSize < timelineData.length;

  useEffect(() => {
    if (!isChartDragging) return;
    const timelineLength = Math.min(chartData.length, Math.max(playIdx, 1));
    const onMove = (e: MouseEvent) => {
      const zoom = chartDragStartWindowRef.current;
      const panel = chartPanelRef.current;
      if (!zoom || !panel) return;
      const maxStart = Math.max(0, timelineLength - zoom.size);
      if (maxStart <= 0) return;
      const width = panel.clientWidth;
      if (width <= 0) return;
      const pxPerPoint = width / Math.max(1, zoom.size);
      const deltaX = e.clientX - chartDragStartXRef.current;
      const deltaPoints = Math.round(deltaX / pxPerPoint);
      const nextStart = Math.min(maxStart, Math.max(0, zoom.start - deltaPoints));
      setZoomWindow((prev) => {
        if (!prev || prev.size !== zoom.size || prev.start === nextStart) return prev;
        return { start: nextStart, size: prev.size };
      });
    };
    const onUp = () => {
      setIsChartDragging(false);
      chartDragStartWindowRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isChartDragging, chartData.length, playIdx]);

  useEffect(() => {
    if (!isNavigatorDragging) return;
    const onMove = (e: MouseEvent) => {
      const drag = navigatorDragStartWindowRef.current;
      const mode = navigatorDragModeRef.current;
      const track = chartNavigatorRef.current;
      if (!drag || !mode || !track) return;
      const width = track.clientWidth;
      if (width <= 0) return;
      const deltaX = e.clientX - navigatorDragStartXRef.current;
      const deltaPoints = Math.round((deltaX / width) * drag.total);
      if (mode === "window") {
        const maxStart = Math.max(0, drag.total - drag.size);
        const nextStart = Math.min(maxStart, Math.max(0, drag.start + deltaPoints));
        if (nextStart === drag.start && drag.size >= drag.total) return;
        if (nextStart === 0 && drag.size >= drag.total) {
          setZoomWindow(null);
          return;
        }
        setZoomWindow({ start: nextStart, size: drag.size });
        return;
      }
      if (mode === "start") {
        const fixedEnd = drag.start + drag.size;
        const maxStart = Math.max(0, fixedEnd - MIN_ZOOM_POINTS);
        const nextStart = Math.min(maxStart, Math.max(0, drag.start + deltaPoints));
        const nextSize = Math.max(MIN_ZOOM_POINTS, fixedEnd - nextStart);
        if (nextStart === 0 && nextSize >= drag.total) {
          setZoomWindow(null);
          return;
        }
        setZoomWindow({ start: nextStart, size: nextSize });
        return;
      }
      const fixedStart = drag.start;
      const minEnd = fixedStart + MIN_ZOOM_POINTS;
      const nextEnd = Math.min(drag.total, Math.max(minEnd, drag.start + drag.size + deltaPoints));
      const nextSize = Math.max(MIN_ZOOM_POINTS, nextEnd - fixedStart);
      if (fixedStart === 0 && nextSize >= drag.total) {
        setZoomWindow(null);
        return;
      }
      setZoomWindow({ start: fixedStart, size: nextSize });
    };
    const onUp = () => {
      setIsNavigatorDragging(false);
      navigatorDragModeRef.current = null;
      navigatorDragStartWindowRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isNavigatorDragging]);

  const tradeHintsByTs = useMemo(() => {
    return events.reduce<Record<number, TradeEventHint[]>>((acc, event) => {
      if (event.type !== "Buy" && event.type !== "Sell" && event.type !== "Error") return acc;
      const ts = event.markerTs ?? chartData[event.dataIdx]?.t;
      if (!ts) return acc;
      if (!acc[ts]) acc[ts] = [];
      acc[ts].push({ type: event.type });
      return acc;
    }, {});
  }, [events, chartData]);

  const allTypes = Object.keys(SIMULATION_EVENT_TYPE_CONFIG) as SimulationEventType[];
  const timelineLastTs = timelineData.length > 0 ? timelineData[timelineData.length - 1].t : -1;

  const { visibleEvents, totalEventsAfterClear } = useMemo(() => {
    const filtered: SimulationLogEvent[] = [];
    let total = 0;
    for (const event of events) {
      const eventTs = chartData[event.dataIdx]?.t ?? -1;
      if (event.dataIdx <= playIdx && eventTs > logClearedAtTs) {
        total += 1;
        if (activeTypes.has(event.type)) filtered.push(event);
      }
    }
    return { visibleEvents: filtered, totalEventsAfterClear: total };
  }, [events, chartData, playIdx, logClearedAtTs, activeTypes]);

  const renderedEvents = useMemo(
    () => [...visibleEvents].reverse().slice(0, MAX_RENDERED_LOG_EVENTS),
    [visibleEvents],
  );

  useLayoutEffect(() => {
    const el = logListRef.current;
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
  }, [renderedEvents]);

  useEffect(() => {
    setZoomWindow((prev) => {
      if (!prev) return null;
      const maxCount = timelineData.length;
      if (maxCount <= 0) return null;
      const nextSize = Math.min(prev.size, maxCount);
      const nextStart = Math.min(prev.start, Math.max(0, maxCount - nextSize));
      if (nextSize >= maxCount) return null;
      return { start: nextStart, size: nextSize };
    });
  }, [timelineData.length]);

  const toggleAverage = () => {
    setVisibility((prev) => {
      const nextAvg = !prev.avg;
      const next: Record<string, boolean> = { ...prev, avg: nextAvg };
      if (nextAvg) {
        for (const net of networks) {
          if (!tradingNetworkIds.has(net.id)) {
            next[`${net.id}_buy`] = false;
            next[`${net.id}_sell`] = false;
          }
        }
      }
      return next;
    });
  };

  const toggleVis = (key: VisKey) => {
    if (key === "avg") {
      toggleAverage();
      return;
    }
    const isBuyKey = key.endsWith("_buy");
    const isSellKey = key.endsWith("_sell");
    const netId = isBuyKey ? key.slice(0, -4) : isSellKey ? key.slice(0, -5) : "";
    const isTrading = tradingNetworkIds.has(netId);
    setVisibility((prev) => {
      const next: Record<string, boolean> = { ...prev, [key]: !prev[key] };
      if (!isTrading && next[key]) next.avg = false;
      if (next.avg && !isTrading) next[key] = false;
      const anyPriceVisible = networks.some((net) => next[`${net.id}_buy`] || next[`${net.id}_sell`]);
      if (!anyPriceVisible) next.avg = true;
      if (next.avg) {
        for (const net of networks) {
          if (!tradingNetworkIds.has(net.id)) {
            next[`${net.id}_buy`] = false;
            next[`${net.id}_sell`] = false;
          }
        }
      }
      return next;
    });
  };

  const toggleNetwork = (netId: string) => {
    const bk = `${netId}_buy` as VisKey;
    const sk = `${netId}_sell` as VisKey;
    const isTrading = tradingNetworkIds.has(netId);
    setVisibility((prev) => {
      const bothOn = prev[bk] && prev[sk];
      const next: Record<string, boolean> = { ...prev, [bk]: !bothOn, [sk]: !bothOn };
      if (!isTrading && (next[bk] || next[sk])) next.avg = false;
      const anyPriceVisible = networks.some((net) => next[`${net.id}_buy`] || next[`${net.id}_sell`]);
      if (!anyPriceVisible) next.avg = true;
      if (next.avg) {
        for (const net of networks) {
          if (!tradingNetworkIds.has(net.id)) {
            next[`${net.id}_buy`] = false;
            next[`${net.id}_sell`] = false;
          }
        }
      }
      return next;
    });
  };

  const toggleType = (type: SimulationEventType) => {
    setActiveTypes((prev) => {
      const n = new Set(prev);
      if (n.has(type)) n.delete(type);
      else n.add(type);
      return n;
    });
  };

  const goToPrevEvent = () => {
    const prev = [...events].reverse().find((e) => e.dataIdx < playIdx && e.dataIdx > 0);
    if (prev) onPlayIdxChange(prev.dataIdx);
  };

  const goToNextEvent = () => {
    const next = events.find((e) => e.dataIdx > playIdx);
    if (next) onPlayIdxChange(next.dataIdx);
  };

  const jumpToEventPoint = (event: SimulationLogEvent) => {
    const targetIdx = Math.max(0, Math.min(Math.max(0, chartData.length - 1), event.dataIdx));
    onPlayIdxChange(Math.min(chartData.length, targetIdx + 1));
    setIsPlaying(false);
    if (!zoomWindow) return;
    const currentStart = zoomWindow.start;
    const currentEnd = zoomWindow.start + zoomWindow.size - 1;
    if (targetIdx < currentStart || targetIdx > currentEnd) {
      const centeredStart = Math.max(
        0,
        Math.min(
          targetIdx - Math.floor(zoomWindow.size / 2),
          Math.max(0, chartData.length - zoomWindow.size),
        ),
      );
      setZoomWindow({ start: centeredStart, size: zoomWindow.size });
    }
  };

  const resetZoom = () => setZoomWindow(null);

  const panZoomByButton = (direction: -1 | 1) => {
    if (!zoomWindow) return;
    const pointsCount = timelineData.length;
    if (pointsCount <= 1) return;
    const panBy = Math.max(1, Math.round(zoomWindow.size * 0.15));
    const nextStart = Math.min(
      Math.max(0, zoomWindow.start + direction * panBy),
      Math.max(0, pointsCount - zoomWindow.size),
    );
    if (nextStart === zoomWindow.start) return;
    setZoomWindow({ start: nextStart, size: zoomWindow.size });
  };

  const zoomByButton = (zoomIn: boolean) => {
    const pointsCount = timelineData.length;
    if (pointsCount <= 1) return;
    const current = zoomWindow ?? { start: 0, size: pointsCount };
    const factor = zoomIn ? 0.7 : 1.3;
    let nextSize = Math.round(current.size * factor);
    nextSize = Math.max(Math.min(pointsCount, nextSize), Math.min(MIN_ZOOM_POINTS, pointsCount));
    if (nextSize >= pointsCount) {
      setZoomWindow(null);
      return;
    }
    setZoomWindow({ start: Math.max(0, pointsCount - nextSize), size: nextSize });
  };

  const toggleFullscreen = async () => {
    const panel = chartPanelRef.current;
    if (!panel) return;
    try {
      if (document.fullscreenElement === panel) await document.exitFullscreen();
      else await panel.requestFullscreen();
    } catch {
      // ignore fullscreen API errors
    }
  };

  const handleChartWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (timelineData.length <= 1) return;

    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    const isHorizontalScroll = absX > absY || (e.shiftKey && absY > 0);
    const current = zoomWindow ?? { start: 0, size: timelineData.length };

    if (isHorizontalScroll) {
      if (!zoomWindow) return;
      const panBy = Math.max(1, Math.round(current.size * 0.08));
      const direction = (e.deltaX !== 0 ? e.deltaX : e.deltaY) > 0 ? 1 : -1;
      const nextStart = Math.min(
        Math.max(0, current.start + direction * panBy),
        Math.max(0, timelineData.length - current.size),
      );
      if (nextStart !== current.start) setZoomWindow({ start: nextStart, size: current.size });
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = rect.width > 0 ? Math.min(1, Math.max(0, x / rect.width)) : 0.5;
    const anchorIdx = current.start + ratio * Math.max(0, current.size - 1);
    const zoomIn = e.deltaY < 0;
    const factor = zoomIn ? 0.65 : 1.35;

    let nextSize = Math.round(current.size * factor);
    nextSize = Math.max(
      Math.min(timelineData.length, nextSize),
      Math.min(MIN_ZOOM_POINTS, timelineData.length),
    );

    if (nextSize >= timelineData.length) {
      setZoomWindow(null);
      return;
    }

    const rawStart = Math.round(anchorIdx - ratio * Math.max(0, nextSize - 1));
    const nextStart = Math.min(Math.max(0, rawStart), timelineData.length - nextSize);
    setZoomWindow({ start: nextStart, size: nextSize });
  };

  const handleChartMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button")) return;
    if (!zoomWindow) return;
    if (timelineData.length <= zoomWindow.size) return;
    setHoverCrosshair(null);
    chartDragStartXRef.current = e.clientX;
    chartDragStartWindowRef.current = { ...zoomWindow };
    setIsChartDragging(true);
    e.preventDefault();
  };

  const startNavigatorDrag = (mode: NavigatorDragMode, e: ReactMouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const total = Math.max(1, timelineData.length);
    if (total <= 1) return;
    const current = zoomWindow ?? { start: 0, size: total };
    navigatorDragStartXRef.current = e.clientX;
    navigatorDragModeRef.current = mode;
    navigatorDragStartWindowRef.current = { ...current, total };
    setIsNavigatorDragging(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const borderColor = isDark ? "#1E2D40" : "#D1D9E0";
  const textPrimary = isDark ? "#E8EDF2" : "#0F1923";
  const textSecondary = isDark ? "#6B7A8D" : "#5A6A7A";
  const textTertiary = isDark ? "#C4CDD8" : "#374151";
  const chartTickColor = isDark ? "#9FB1C7" : "#334155";
  const chartGridColor = isDark ? "#223247" : "#CBD5E1";
  const chartAxisColor = isDark ? "#2A3B52" : "#94A3B8";
  const averageLineColor = "#D4A900";
  const stepLineInterpolation = { type: "step" as const, position: "end" as const };
  const surfaceBg = isDark ? "#0D1520" : "#F5F7FA";
  const panelBg = isDark ? "#111722" : "#FFFFFF";
  const inputBg = isDark ? "#1A2333" : "#E8ECF0";
  const accent = isDark ? "#F5C400" : "#D4A900";

  const hasRenderableSeries = useMemo(() => {
    if (visibility.avg) return true;
    return networks.some((net) => visibility[`${net.id}_buy`] || visibility[`${net.id}_sell`]);
  }, [visibility, networks]);

  const hoverYDomain = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const pushValue = (value: unknown) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      if (value < min) min = value;
      if (value > max) max = value;
    };
    for (const point of visibleData) {
      if (visibility.avg) pushValue(point.avg);
      for (const net of networks) {
        if (visibility[`${net.id}_buy`]) pushValue(point[`${net.id}_buy`]);
        if (visibility[`${net.id}_sell`]) pushValue(point[`${net.id}_sell`]);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
    if (max <= min) return { min, max: min + 1 };
    return { min, max };
  }, [visibleData, visibility, networks]);

  const handleChartMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (loading || visibleData.length === 0 || !hasRenderableSeries || isChartDragging || isNavigatorDragging) {
      setHoverCrosshair(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const plotLeft = CHART_PLOT_PADDING.left;
    const plotRight = CHART_PLOT_PADDING.right;
    const plotTop = CHART_PLOT_PADDING.top;
    const plotBottom = CHART_PLOT_PADDING.bottom;
    const plotWidth = Math.max(1, rect.width - plotLeft - plotRight);
    const plotHeight = Math.max(1, rect.height - plotTop - plotBottom);
    const xRaw = e.clientX - rect.left;
    const xClamped = Math.min(plotLeft + plotWidth, Math.max(plotLeft, xRaw));
    const ratio = (xClamped - plotLeft) / plotWidth;
    const nearestIdx = Math.round(ratio * Math.max(0, visibleData.length - 1));
    const point = visibleData[nearestIdx];
    if (!point) {
      setHoverCrosshair(null);
      return;
    }

    let price: number | null = null;
    if (visibility.avg && typeof point.avg === "number" && Number.isFinite(point.avg)) {
      price = point.avg;
    } else {
      for (const net of networks) {
        if (price === null && visibility[`${net.id}_buy`]) {
          const val = point[`${net.id}_buy`];
          if (typeof val === "number" && Number.isFinite(val)) price = val;
        }
        if (price === null && visibility[`${net.id}_sell`]) {
          const val = point[`${net.id}_sell`];
          if (typeof val === "number" && Number.isFinite(val)) price = val;
        }
      }
    }
    if (
      price === null ||
      !Number.isFinite(price) ||
      typeof point.t !== "number" ||
      !Number.isFinite(point.t)
    ) {
      setHoverCrosshair(null);
      return;
    }
    if (!Number.isFinite(hoverYDomain.min) || !Number.isFinite(hoverYDomain.max)) {
      setHoverCrosshair(null);
      return;
    }
    const yRatio = (price - hoverYDomain.min) / Math.max(hoverYDomain.max - hoverYDomain.min, 1e-9);
    const yPx = plotTop + (1 - Math.min(1, Math.max(0, yRatio))) * plotHeight;
    const avgVal = typeof point.avg === "number" && Number.isFinite(point.avg) ? point.avg : undefined;
    let buyVal: number | undefined;
    let sellVal: number | undefined;
    for (const net of networks) {
      if (buyVal === undefined) {
        const v = point[`${net.id}_buy`];
        if (typeof v === "number" && Number.isFinite(v)) buyVal = v;
      }
      if (sellVal === undefined) {
        const v = point[`${net.id}_sell`];
        if (typeof v === "number" && Number.isFinite(v)) sellVal = v;
      }
    }
    const tradeHint = point.t
      ? (tradeHintsByTs[point.t] ?? []).find((ev) => ev.type === "Buy" || ev.type === "Sell" || ev.type === "Error")
      : undefined;
    setHoverCrosshair({
      xPx: plotLeft + ratio * plotWidth,
      yPx,
      ts: point.t,
      price,
      avg: avgVal,
      buy: buyVal,
      sell: sellVal,
      tradeType: tradeHint?.type,
    });
  };

  const chartRenderData = useMemo(() => {
    return visibleData
      .map((point) => {
        if (!Number.isFinite(point.t)) return null;
        if (typeof point.xLabel !== "string") {
          return { ...point, xLabel: chartDateTime(Number(point.t)) };
        }
        return point;
      })
      .filter((row): row is SimulationChartPoint => row !== null);
  }, [visibleData]);

  const tradeMarkerData = useMemo(() => {
    const buy: Array<{ t: number; y: number }> = [];
    const sell: Array<{ t: number; y: number }> = [];
    const error: Array<{ t: number; y: number }> = [];
    for (const ev of events) {
      if (ev.type !== "Buy" && ev.type !== "Sell" && ev.type !== "Error") continue;
      const ts = ev.markerTs ?? chartData[ev.dataIdx]?.t;
      if (!ts) continue;
      const inWindow =
        ts >= (visibleData[0]?.t ?? Number.NEGATIVE_INFINITY) &&
        ts <= (visibleData[visibleData.length - 1]?.t ?? Number.POSITIVE_INFINITY);
      if (!inWindow) continue;
      let y = ev.markerPrice;
      if (typeof y !== "number" || !Number.isFinite(y)) {
        const nearest = chartData[ev.dataIdx];
        y = typeof nearest?.avg === "number" ? nearest.avg : undefined;
      }
      if (typeof y !== "number" || !Number.isFinite(y)) continue;
      const marker = { t: ts, y };
      if (ev.type === "Buy") buy.push(marker);
      else if (ev.type === "Sell") sell.push(marker);
      else error.push(marker);
    }
    return { buy, sell, error };
  }, [events, visibleData, chartData]);

  const tradeExecutionBarData = useMemo(() => {
    const byId = new Map(events.map((event) => [event.id, event]));
    const buy: Array<{
      t: number;
      yLow: number;
      yHigh: number;
      requestPrice: number;
      executedPrice: number;
      requestTs: number;
      responseTs: number;
      delayMs: number;
      slippagePct: number;
    }> = [];
    const sell: typeof buy = [];
    const error: Array<(typeof buy)[0] & { requestSide: "buy" | "sell" }> = [];
    const minTs = visibleData[0]?.t ?? Number.NEGATIVE_INFINITY;
    const maxTs = visibleData[visibleData.length - 1]?.t ?? Number.POSITIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (const point of visibleData) {
      const avg = point.avg;
      if (typeof avg === "number" && Number.isFinite(avg)) {
        if (avg < yMin) yMin = avg;
        if (avg > yMax) yMax = avg;
      }
      for (const net of networks) {
        const buyVal = point[`${net.id}_buy`];
        const sellVal = point[`${net.id}_sell`];
        if (typeof buyVal === "number" && Number.isFinite(buyVal)) {
          if (buyVal < yMin) yMin = buyVal;
          if (buyVal > yMax) yMax = buyVal;
        }
        if (typeof sellVal === "number" && Number.isFinite(sellVal)) {
          if (sellVal < yMin) yMin = sellVal;
          if (sellVal > yMax) yMax = sellVal;
        }
      }
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return { buy, sell, error };
    const padding = Math.max((yMax - yMin) * 0.02, 0.0001);
    if (yMax <= yMin) yMax = yMin + 1;
    const barLow = yMin - padding;
    const barHigh = yMax + padding;

    for (const event of events) {
      if (!event.id.endsWith("-resp")) continue;
      const requestId = event.id.slice(0, -5);
      const request = byId.get(requestId);
      if (!request) continue;

      const requestTs = request.markerTs ?? chartData[request.dataIdx]?.t;
      const responseTs = event.markerTs ?? chartData[event.dataIdx]?.t;
      const requestPrice = request.markerPrice;
      const responsePrice = event.type === "Error" ? request.markerPrice : event.markerPrice;
      if (!requestTs || !responseTs) continue;
      const requestPriceNum = Number(requestPrice);
      const responsePriceNum = Number(responsePrice);
      if (!Number.isFinite(requestPriceNum) || !Number.isFinite(responsePriceNum)) continue;

      const inWindow =
        requestTs >= minTs && requestTs <= maxTs && responseTs >= minTs && responseTs <= maxTs;
      if (!inWindow) continue;
      const delayMs = Math.max(0, responseTs - requestTs);
      const slippagePct =
        requestPriceNum === 0 ? 0 : ((responsePriceNum - requestPriceNum) / requestPriceNum) * 100;
      const bar = {
        t: responseTs,
        yLow: barLow,
        yHigh: barHigh,
        requestPrice: requestPriceNum,
        executedPrice: responsePriceNum,
        requestTs,
        responseTs,
        delayMs,
        slippagePct,
      };
      if (event.type === "Buy") buy.push(bar);
      if (event.type === "Sell") sell.push(bar);
      if (event.type === "Error") {
        error.push({ ...bar, requestSide: request.type === "Sell" ? "sell" : "buy" });
      }
    }
    return { buy, sell, error };
  }, [events, chartData, visibleData, networks]);

  const tradeExecutionBands = useMemo(() => {
    const toBands = (
      rows: Array<{
        t: number;
        yLow: number;
        yHigh: number;
        requestPrice: number;
        executedPrice: number;
        requestTs: number;
        responseTs: number;
        delayMs: number;
        slippagePct: number;
        requestSide?: "buy" | "sell";
      }>,
      side: "buy" | "sell" | "error",
    ) =>
      rows.map((row, idx) => ({
        id: `${side}-${row.requestTs}-${row.responseTs}-${idx}`,
        side,
        requestSide: row.requestSide,
        data: [
          {
            t: row.requestTs,
            yMid: (row.yLow + row.yHigh) / 2,
            requestPrice: row.requestPrice,
            executedPrice: row.executedPrice,
            requestTs: row.requestTs,
            responseTs: row.responseTs,
            delayMs: row.delayMs,
            slippagePct: row.slippagePct,
          },
          {
            t: row.responseTs,
            yMid: (row.yLow + row.yHigh) / 2,
            requestPrice: row.requestPrice,
            executedPrice: row.executedPrice,
            requestTs: row.requestTs,
            responseTs: row.responseTs,
            delayMs: row.delayMs,
            slippagePct: row.slippagePct,
          },
        ],
      }));
    return [
      ...toBands(tradeExecutionBarData.buy, "buy"),
      ...toBands(tradeExecutionBarData.sell, "sell"),
      ...toBands(tradeExecutionBarData.error, "error"),
    ];
  }, [tradeExecutionBarData]);

  const agChartOptions = useMemo(() => {
    const series: Record<string, unknown>[] = [];

    if (visibility.avg) {
      series.push({
        type: "line",
        xKey: "t",
        yKey: "avg",
        yName: "Average",
        stroke: averageLineColor,
        strokeWidth: 2.6,
        lineCap: "square",
        interpolation: stepLineInterpolation,
        marker: { enabled: false },
        connectMissingData: false,
        tooltip: { enabled: true },
      });
    }

    for (const net of networks) {
      const buyKey = `${net.id}_buy`;
      const sellKey = `${net.id}_sell`;
      if (visibility[buyKey]) {
        series.push({
          type: "line",
          xKey: "t",
          yKey: buyKey,
          yName: `${net.label} Buy`,
          stroke: tradingNetworkIds.has(net.id) ? "#10B981" : net.color,
          strokeWidth: 1.4,
          lineCap: "square",
          interpolation: stepLineInterpolation,
          marker: { enabled: false },
          connectMissingData: false,
          tooltip: { enabled: true },
        });
      }
      if (visibility[sellKey]) {
        series.push({
          type: "line",
          xKey: "t",
          yKey: sellKey,
          yName: `${net.label} Sell`,
          stroke: tradingNetworkIds.has(net.id) ? "#E5383B" : net.color,
          lineDash: tradingNetworkIds.has(net.id) ? undefined : [4, 2],
          strokeWidth: 1.4,
          lineCap: "square",
          interpolation: stepLineInterpolation,
          marker: { enabled: false },
          connectMissingData: false,
          tooltip: { enabled: true },
        });
      }
    }

    if (tradeMarkerData.buy.length > 0) {
      series.push({
        type: "scatter",
        xKey: "t",
        yKey: "y",
        yName: "BUY point",
        data: tradeMarkerData.buy,
        shape: "circle",
        size: 6,
        fill: "#10B981",
        stroke: "#10B981",
        strokeWidth: 1,
        tooltip: { enabled: true },
      });
    }
    if (tradeMarkerData.sell.length > 0) {
      series.push({
        type: "scatter",
        xKey: "t",
        yKey: "y",
        yName: "SELL point",
        data: tradeMarkerData.sell,
        shape: "circle",
        size: 6,
        fill: "#E5383B",
        stroke: "#E5383B",
        strokeWidth: 1,
        tooltip: { enabled: true },
      });
    }
    if (tradeMarkerData.error.length > 0) {
      series.push({
        type: "scatter",
        xKey: "t",
        yKey: "y",
        yName: "ERROR point",
        data: tradeMarkerData.error,
        shape: "circle",
        size: 6,
        fill: "#EAB308",
        stroke: "#EAB308",
        strokeWidth: 1,
        tooltip: { enabled: true },
      });
    }

    for (const band of tradeExecutionBands) {
      series.push({
        type: "line",
        xKey: "t",
        yKey: "yMid",
        yName: band.side === "buy" ? "BUY fill" : band.side === "sell" ? "SELL fill" : "ERROR fill",
        data: band.data,
        stroke: band.side === "buy" ? "#10B981" : band.side === "sell" ? "#E5383B" : "#EAB308",
        strokeOpacity: 0.16,
        strokeWidth: 4000,
        lineCap: "butt",
        marker: { enabled: false },
        connectMissingData: false,
        tooltip: {
          enabled: true,
          renderer: (params: { datum?: Record<string, unknown> }) => ({
            title: `${band.side === "buy" ? "BUY" : band.side === "sell" ? "SELL" : `${(band.requestSide ?? "buy").toUpperCase()} ERROR`} fill · ${chartDateTime(Number(params.datum?.responseTs ?? params.datum?.t ?? 0))}`,
            data: [
              { label: "Request price", value: Number(params.datum?.requestPrice ?? 0).toFixed(4) },
              { label: "Executed price", value: Number(params.datum?.executedPrice ?? 0).toFixed(4) },
              { label: "Delay ms", value: String(params.datum?.delayMs ?? 0) },
              { label: "Slippage %", value: `${Number(params.datum?.slippagePct ?? 0).toFixed(4)}%` },
            ],
          }),
        },
        showInLegend: false,
      });
    }

    return {
      data: chartRenderData,
      animation: { enabled: false },
      tooltip: { enabled: true, mode: "shared" },
      legend: { enabled: false },
      background: { fill: "transparent" },
      padding: { top: 8, right: 16, bottom: 8, left: 8 },
      series,
      axes: {
        x: {
          type: "number",
          line: { stroke: chartAxisColor },
          tick: { stroke: chartAxisColor },
          label: {
            color: chartTickColor,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            formatter: (params: { value?: unknown }) => {
              const ts = Number(params?.value);
              if (!Number.isFinite(ts)) return "";
              return chartTimeOnly(ts);
            },
          },
          crosshair: {
            enabled: true,
            snap: true,
            stroke: isDark ? "#9FB1C7" : "#334155",
            strokeWidth: 1,
            strokeOpacity: 0.8,
            lineDash: [6, 6],
            label: {
              enabled: true,
              formatter: (params: { value?: unknown }) => {
                const ts = Number(params?.value);
                if (!Number.isFinite(ts)) return "";
                return chartCrosshairDateTime(ts);
              },
            },
          },
          gridLine: { enabled: false },
        },
        y: {
          type: "number",
          line: { stroke: chartAxisColor },
          tick: { stroke: chartAxisColor },
          label: {
            color: chartTickColor,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            formatter: (params: { value: number }) => Number(params.value).toFixed(0),
          },
          crosshair: {
            enabled: true,
            snap: true,
            stroke: isDark ? "#9FB1C7" : "#334155",
            strokeWidth: 1,
            strokeOpacity: 0.8,
            lineDash: [6, 6],
            label: {
              enabled: true,
              formatter: (params: { value?: unknown }) => {
                const value = Number(params?.value);
                if (!Number.isFinite(value)) return "";
                return value.toFixed(4);
              },
            },
          },
          gridLine: { enabled: true, style: [{ stroke: chartGridColor, lineDash: [2, 4] }] },
        },
      },
    };
  }, [
    chartRenderData,
    visibility,
    networks,
    tradingNetworkIds,
    averageLineColor,
    chartAxisColor,
    chartTickColor,
    chartGridColor,
    tradeMarkerData,
    tradeExecutionBands,
    isDark,
  ]);

  const agChartSafeOptions = useMemo(() => {
    const data = visibleData
      .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.avg))
      .map((point) => ({ t: Number(point.t), avg: Number(point.avg) }));
    return {
      data,
      animation: { enabled: false },
      tooltip: { enabled: true, mode: "shared" },
      legend: { enabled: false },
      background: { fill: "transparent" },
      series: [
        {
          type: "line",
          xKey: "t",
          yKey: "avg",
          yName: "Average",
          stroke: averageLineColor,
          strokeWidth: 2,
          lineCap: "square",
          interpolation: stepLineInterpolation,
          marker: { enabled: false },
          connectMissingData: false,
        },
      ],
      axes: {
        x: {
          type: "number",
          line: { stroke: chartAxisColor },
          tick: { stroke: chartAxisColor },
          label: {
            color: chartTickColor,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            formatter: (params: { value: number }) => {
              const ts = Number(params.value);
              if (!Number.isFinite(ts)) return "";
              return chartTimeOnly(ts);
            },
          },
          crosshair: {
            enabled: true,
            snap: true,
            stroke: isDark ? "#9FB1C7" : "#334155",
            strokeWidth: 1,
            strokeOpacity: 0.8,
            lineDash: [6, 6],
            label: {
              enabled: true,
              formatter: (params: { value?: unknown }) => {
                const ts = Number(params?.value);
                if (!Number.isFinite(ts)) return "";
                return chartCrosshairDateTime(ts);
              },
            },
          },
          gridLine: { enabled: false },
        },
        y: {
          type: "number",
          line: { stroke: chartAxisColor },
          tick: { stroke: chartAxisColor },
          label: {
            color: chartTickColor,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            formatter: (params: { value: number }) => Number(params.value).toFixed(0),
          },
          crosshair: {
            enabled: true,
            snap: true,
            stroke: isDark ? "#9FB1C7" : "#334155",
            strokeWidth: 1,
            strokeOpacity: 0.8,
            lineDash: [6, 6],
            label: {
              enabled: true,
              formatter: (params: { value?: unknown }) => {
                const value = Number(params?.value);
                if (!Number.isFinite(value)) return "";
                return value.toFixed(4);
              },
            },
          },
          gridLine: { enabled: true, style: [{ stroke: chartGridColor, lineDash: [2, 4] }] },
        },
      },
    };
  }, [visibleData, averageLineColor, stepLineInterpolation, chartAxisColor, chartTickColor, chartGridColor, isDark]);

  const lastPriceDisplay = header.lastPrice ?? "—";

  return (
    <div className={`flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden ${className ?? ""}`}>
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        style={{ borderRight: `1px solid ${borderColor}` }}
      >
        <div className="px-4 pt-3 pb-2 shrink-0" style={{ borderBottom: `1px solid ${borderColor}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "14px", fontWeight: 600, color: textPrimary }}>{header.pairLabel}</span>
              <span style={{ fontSize: "11px", color: textSecondary }}>{header.networksLabel}</span>
              {header.badge}
              {loading && <Loader2 size={12} className="animate-spin" style={{ color: textSecondary }} />}
              {error && <span style={{ fontSize: "11px", color: "#E5383B" }}>API error</span>}
            </div>
            <div className="flex items-center gap-2">
              {header.live && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#10B981" }} />
              )}
              <span style={{ fontSize: "13px", fontFamily: "var(--font-mono)", color: textTertiary }}>
                {lastPriceDisplay} USDT
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ border: `1px solid ${borderColor}`, color: textSecondary, fontFamily: "var(--font-mono)" }}
            >
              ID: {header.id ?? "—"}
            </span>
            <span className="px-2 py-0.5 rounded text-xs" style={{ border: `1px solid ${borderColor}`, color: textSecondary }}>
              Статус: {header.status ?? "—"}
            </span>
            <span className="px-2 py-0.5 rounded text-xs" style={{ border: `1px solid ${borderColor}`, color: textSecondary }}>
              Правила: {header.rules ?? 0}
            </span>
            <span className="px-2 py-0.5 rounded text-xs" style={{ border: `1px solid ${borderColor}`, color: textSecondary }}>
              Profit: {header.profitCurrency ?? "USDT"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2">
            <button
              onClick={() => toggleVis("avg")}
              className="flex items-center gap-1.5 text-xs transition-opacity"
              style={{ opacity: visibility.avg ? 1 : 0.35, color: textTertiary }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "20px",
                  height: "2px",
                  backgroundColor: averageLineColor,
                  verticalAlign: "middle",
                }}
              />
              Average
            </button>
            {networks.map((net) => {
              const bk = `${net.id}_buy` as VisKey;
              const sk = `${net.id}_sell` as VisKey;
              const anyOn = visibility[bk] || visibility[sk];
              const isTrading = tradingNetworkIds.has(net.id);
              const pairColor = isTrading ? "#10B981" : net.color;
              const buyColor = isTrading ? "#10B981" : net.color;
              const sellColor = isTrading ? "#E5383B" : net.color;
              return (
                <div key={net.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleNetwork(net.id)}
                    className="flex items-center gap-1.5 text-xs transition-opacity"
                    style={{ opacity: anyOn ? 1 : 0.35, color: textTertiary }}
                  >
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: pairColor }} />
                    {net.label}
                  </button>
                  <button
                    onClick={() => toggleVis(bk)}
                    className="flex items-center px-1 py-0.5 rounded text-xs transition-colors"
                    style={{
                      opacity: visibility[bk] ? 1 : 0.4,
                      color: buyColor,
                      backgroundColor: visibility[bk] ? `${buyColor}1A` : "transparent",
                      border: `1px solid ${buyColor}40`,
                    }}
                  >
                    <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>B</span>
                  </button>
                  <button
                    onClick={() => toggleVis(sk)}
                    className="flex items-center px-1 py-0.5 rounded text-xs transition-colors"
                    style={{
                      opacity: visibility[sk] ? 1 : 0.4,
                      color: sellColor,
                      backgroundColor: visibility[sk] ? `${sellColor}1A` : "transparent",
                      border: `1px solid ${sellColor}40`,
                    }}
                  >
                    <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>S</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div
          ref={chartPanelRef}
          className="relative min-h-0 w-full flex-1"
          style={{
            minWidth: 0,
            cursor: zoomWindow ? (isChartDragging ? "grabbing" : "grab") : "default",
          }}
          onWheel={handleChartWheel}
          onMouseDown={handleChartMouseDown}
          onMouseMove={handleChartMouseMove}
          onMouseLeave={() => setHoverCrosshair(null)}
        >
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin" style={{ color: accent }} />
              <span style={{ fontSize: "12px", color: textSecondary }}>{loadingMessage}</span>
            </div>
          ) : error && visibleData.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ fontSize: "12px", color: "#E5383B" }}>Failed to load data from API</span>
            </div>
          ) : visibleData.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ fontSize: "12px", color: textSecondary }}>Waiting for live data…</span>
            </div>
          ) : !hasRenderableSeries ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ fontSize: "12px", color: textSecondary }}>No visible series selected</span>
            </div>
          ) : (
            <div className="w-full h-full">
              <ChartErrorBoundary
                onError={(message) => {
                  setChartErrorMessage(message);
                  setChartSafeMode(true);
                }}
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span style={{ fontSize: "12px", color: "#E5383B" }}>
                      Chart render error (AG Charts)
                      {chartErrorMessage ? `: ${chartErrorMessage}` : ""}
                    </span>
                  </div>
                }
              >
                <AgCharts
                  options={(chartSafeMode ? agChartSafeOptions : agChartOptions) as never}
                  style={{ width: "100%", height: "100%" }}
                />
              </ChartErrorBoundary>
              {chartSafeMode && (
                <div
                  className="absolute left-3 top-3 px-2 py-1 rounded text-[10px]"
                  style={{ backgroundColor: `${accent}22`, border: `1px solid ${accent}55`, color: textSecondary }}
                >
                  Safe chart mode
                </div>
              )}
              {hoverCrosshair && (
                <>
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${hoverCrosshair.xPx}px`,
                      top: `${CHART_PLOT_PADDING.top}px`,
                      height: `calc(100% - ${CHART_PLOT_PADDING.top + CHART_PLOT_PADDING.bottom}px)`,
                      borderLeft: `1px dashed ${isDark ? "#9FB1C7AA" : "#334155AA"}`,
                    }}
                  />
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${CHART_PLOT_PADDING.left}px`,
                      right: `${CHART_PLOT_PADDING.right}px`,
                      top: `${hoverCrosshair.yPx}px`,
                      borderTop: `1px dashed ${isDark ? "#9FB1C7AA" : "#334155AA"}`,
                    }}
                  />
                  <div
                    className="absolute px-2 py-0.5 rounded text-[11px] pointer-events-none"
                    style={{
                      left: `${hoverCrosshair.xPx}px`,
                      bottom: "2px",
                      transform: "translateX(-50%)",
                      backgroundColor: isDark ? "#0A1119" : "#FFFFFF",
                      border: `1px solid ${borderColor}`,
                      color: textPrimary,
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {chartCrosshairDateTime(hoverCrosshair.ts)}
                  </div>
                  <div
                    className="absolute px-1.5 py-0.5 rounded text-[11px] pointer-events-none"
                    style={{
                      left: "2px",
                      top: `${hoverCrosshair.yPx}px`,
                      transform: "translateY(-50%)",
                      backgroundColor: isDark ? "#0A1119" : "#FFFFFF",
                      border: `1px solid ${borderColor}`,
                      color: textPrimary,
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {hoverCrosshair.price.toFixed(4)}
                  </div>
                  <div
                    className="absolute rounded p-2 pointer-events-none min-w-44"
                    style={{
                      left: `${Math.min(hoverCrosshair.xPx + 12, (chartPanelRef.current?.clientWidth ?? 400) - 180)}px`,
                      top: `${CHART_PLOT_PADDING.top + 8}px`,
                      backgroundColor: isDark ? "#111722" : "#FFFFFF",
                      border: `1px solid ${borderColor}`,
                      fontSize: "11px",
                      zIndex: 5,
                    }}
                  >
                    <div className="flex justify-between gap-3 mb-1">
                      <span style={{ color: textSecondary, fontFamily: "var(--font-mono)" }}>Время</span>
                      <span style={{ color: textPrimary, fontFamily: "var(--font-mono)" }}>
                        {chartCrosshairDateTime(hoverCrosshair.ts)}
                      </span>
                    </div>
                    {hoverCrosshair.avg !== undefined && (
                      <div className="flex justify-between gap-3 mb-1">
                        <span style={{ color: textSecondary }}>Среднее</span>
                        <span style={{ color: textPrimary, fontFamily: "var(--font-mono)" }}>
                          {hoverCrosshair.avg.toFixed(4)}
                        </span>
                      </div>
                    )}
                    {hoverCrosshair.buy !== undefined && (
                      <div className="flex justify-between gap-3 mb-1">
                        <span style={{ color: textSecondary }}>Buy</span>
                        <span style={{ color: "#10B981", fontFamily: "var(--font-mono)" }}>
                          {hoverCrosshair.buy.toFixed(4)}
                        </span>
                      </div>
                    )}
                    {hoverCrosshair.sell !== undefined && (
                      <div className="flex justify-between gap-3 mb-1">
                        <span style={{ color: textSecondary }}>Sell</span>
                        <span style={{ color: "#E5383B", fontFamily: "var(--font-mono)" }}>
                          {hoverCrosshair.sell.toFixed(4)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 pt-1" style={{ borderTop: `1px solid ${borderColor}` }}>
                      <span style={{ color: textSecondary }}>Сделка</span>
                      <span
                        style={{
                          color:
                            hoverCrosshair.tradeType === "Buy"
                              ? "#10B981"
                              : hoverCrosshair.tradeType === "Sell"
                                ? "#E5383B"
                                : hoverCrosshair.tradeType === "Error"
                                  ? "#EAB308"
                                  : textPrimary,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {hoverCrosshair.tradeType ?? "—"}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <button
              onClick={resetZoom}
              className="px-2 py-1 rounded text-xs min-w-[70px]"
              style={{
                backgroundColor: panelBg,
                border: `1px solid ${borderColor}`,
                color: textSecondary,
                visibility: isZoomed ? "visible" : "hidden",
                pointerEvents: isZoomed ? "auto" : "none",
              }}
            >
              Сбросить
            </button>
            <button
              onClick={() => zoomByButton(false)}
              className="w-7 h-7 rounded text-sm flex items-center justify-center"
              style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, color: textSecondary }}
              title="Отдалить"
            >
              -
            </button>
            <button
              onClick={() => zoomByButton(true)}
              className="w-7 h-7 rounded text-sm flex items-center justify-center"
              style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, color: textSecondary }}
              title="Приблизить"
            >
              +
            </button>
            <div
              className="flex items-center rounded overflow-hidden"
              style={{
                backgroundColor: panelBg,
                border: `1px solid ${borderColor}`,
                opacity: isZoomed ? 1 : 0.55,
              }}
            >
              <button
                onClick={() => panZoomByButton(-1)}
                className="w-7 h-7 flex items-center justify-center"
                style={{ color: textSecondary, borderRight: `1px solid ${borderColor}` }}
                title="Сдвинуть влево"
                disabled={!isZoomed}
              >
                <ChevronLeft size={12} />
              </button>
              <button
                onClick={() => panZoomByButton(1)}
                className="w-7 h-7 flex items-center justify-center"
                style={{ color: textSecondary }}
                title="Сдвинуть вправо"
                disabled={!isZoomed}
              >
                <ChevronRight size={12} />
              </button>
            </div>
            <button
              onClick={toggleFullscreen}
              className="w-7 h-7 rounded flex items-center justify-center"
              style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, color: textSecondary }}
              title={isFullscreen ? "Выйти из полного экрана" : "Полный экран"}
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
        </div>

        {timelineData.length > 1 && (
          <div className="shrink-0 px-4 py-2" style={{ borderTop: `1px solid ${borderColor}`, backgroundColor: surfaceBg }}>
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontSize: "10px",
                  color: textSecondary,
                  fontFamily: "var(--font-mono)",
                  minWidth: "76px",
                }}
              >
                {`view ${((navigatorWindow.size / timelinePoints) * 100).toFixed(1)}%`}
              </span>
              <div
                ref={chartNavigatorRef}
                className="relative flex-1 h-2 rounded-full"
                style={{ backgroundColor: isDark ? "#2A3B52" : "#CBD5E1" }}
              >
                <div
                  className="absolute top-0 h-full rounded-full"
                  style={{
                    left: `${navigatorStartPct}%`,
                    width: `${Math.min(100 - navigatorStartPct, navigatorSizePct)}%`,
                    backgroundColor: `${accent}AA`,
                    cursor: isNavigatorDragging ? "grabbing" : "grab",
                  }}
                  onMouseDown={(e) => startNavigatorDrag("window", e)}
                >
                  <button
                    className="absolute -left-1.5 -top-2 h-6 w-3 rounded-full"
                    style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, cursor: "ew-resize" }}
                    onMouseDown={(e) => startNavigatorDrag("start", e)}
                    aria-label="Левая граница диапазона"
                    type="button"
                  />
                  <button
                    className="absolute -right-1.5 -top-2 h-6 w-3 rounded-full"
                    style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, cursor: "ew-resize" }}
                    onMouseDown={(e) => startNavigatorDrag("end", e)}
                    aria-label="Правая граница диапазона"
                    type="button"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className="shrink-0 flex flex-col"
          style={{
            borderTop: `1px solid ${borderColor}`,
            backgroundColor: surfaceBg,
            height: playerPanelCollapsed ? 34 : playerPanelHeight,
          }}
        >
          <div
            className="group h-1.5 shrink-0 cursor-row-resize flex items-center justify-center"
            style={{ backgroundColor: resizingPlayerPanel ? `${accent}30` : "transparent" }}
            onMouseDown={(e) => {
              playerResizeStartYRef.current = e.clientY;
              playerResizeStartHeightRef.current = playerPanelHeight;
              setResizingPlayerPanel(true);
            }}
          >
            <div
              className="h-0.5 w-10 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
              style={{ backgroundColor: `${accent}80` }}
            />
          </div>
          <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${borderColor}` }}>
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
            <button
              onClick={() => setPlayerPanelCollapsed((v) => !v)}
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ border: `1px solid ${borderColor}`, color: textSecondary }}
            >
              {playerPanelCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          {!playerPanelCollapsed && (
            <div className="px-4 py-3 flex-1 overflow-hidden">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="flex items-center gap-1">
                  <PlayerBtn onClick={goToPrevEvent} title="Previous Event" isDark={isDark}>
                    <SkipBack size={12} />
                  </PlayerBtn>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
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
                      setIsPlaying(false);
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
                  {visibleData[visibleData.length - 1]?.label && (
                    <span style={{ fontSize: "10px", color: textSecondary, fontFamily: "var(--font-mono)" }}>
                      @ {visibleData[visibleData.length - 1].label}
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
                      onClick={() => setSpeed(s)}
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
                      setIsPlaying(false);
                    }}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                  />
                  {events
                    .filter((ev) => ev.type === "Buy" || ev.type === "Sell" || ev.type === "Error")
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
                <span style={{ fontSize: "9px", color: textSecondary, fontFamily: "var(--font-mono)" }}>{maxIdx}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={eventPanelScrollRef}
        className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden relative"
        style={{
          width: eventPanelCollapsed ? "36px" : `${eventPanelWidth}px`,
          borderLeft: `1px solid ${borderColor}`,
        }}
      >
        {!eventPanelCollapsed && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 group flex items-center justify-center"
            style={{ backgroundColor: resizingEventPanel ? `${accent}30` : "transparent" }}
            onMouseDown={(e) => {
              eventResizeStartXRef.current = e.clientX;
              eventResizeStartWidthRef.current = eventPanelWidth;
              setResizingEventPanel(true);
            }}
          >
            <div
              className="w-0.5 h-10 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
              style={{ backgroundColor: `${accent}80` }}
            />
          </div>
        )}
        <div ref={eventPanelHeaderRef} className="px-2.5 py-2 shrink-0" style={{ borderBottom: `1px solid ${borderColor}` }}>
          <div className="flex items-center justify-between gap-2">
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: textPrimary,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
                display: eventPanelCollapsed ? "none" : "inline",
              }}
            >
              Анализ текущего шага
            </span>
            <button
              onClick={() => setEventPanelCollapsed((v) => !v)}
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ border: `1px solid ${borderColor}`, color: textSecondary }}
              title={eventPanelCollapsed ? "Открыть лог" : "Скрыть лог"}
            >
              {eventPanelCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>
        </div>
        {!eventPanelCollapsed && (
          <>
            <div
              ref={stepResultSectionRef}
              className="shrink-0 overflow-y-auto"
              style={{
                height: stepResultHeight,
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
              <StepResultPanel
                event={stepResult}
                isDark={isDark}
                token1Label={token1Label}
                token2Label={token2Label}
              />
            </div>
            <div
              className="group h-1.5 shrink-0 cursor-row-resize flex items-center justify-center"
              style={{ backgroundColor: resizingStepSection ? `${accent}30` : "transparent" }}
              onMouseDown={(e) => {
                stepResizeStartYRef.current = e.clientY;
                stepResizeStartHeightRef.current = stepResultHeight;
                setResizingStepSection(true);
              }}
            >
              <div
                className="h-0.5 w-10 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                style={{ backgroundColor: `${accent}80` }}
              />
            </div>
          </>
        )}
        {!eventPanelCollapsed && (
          <div ref={eventsControlsSectionRef} className="px-2.5 py-2 shrink-0" style={{ borderBottom: `1px solid ${borderColor}` }}>
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
                onClick={() => {
                  setLogClearedAtTs(timelineLastTs);
                  setExpandedEvent(null);
                }}
                className="px-2 py-1 rounded text-xs transition-colors shrink-0"
                style={{ border: `1px solid ${borderColor}`, color: textSecondary, fontFamily: "var(--font-mono)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = textPrimary;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = textSecondary;
                }}
              >
                Очистить лог
              </button>
              <div className="relative flex-1 min-w-0" ref={filterRef}>
                <button
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
                          onClick={() => toggleType(type)}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors"
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = isDark ? "#1A2333" : "#F0F2F5";
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
                              <span style={{ fontSize: "9px", color: cfg.color, fontWeight: 700, lineHeight: 1 }}>✓</span>
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
        {!eventPanelCollapsed && (
          <div
            ref={logListRef}
            className="min-h-0 flex-1 overflow-y-auto"
            style={{
              minHeight: EVENT_LOG_MIN_HEIGHT_PX,
              scrollbarWidth: "thin",
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
                        onJumpToPoint={() => jumpToEventPoint(event)}
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
    </div>
  );
}
