import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
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
} from "lucide-react";
import { useSimulatorI18n } from "./useSimulatorI18n";
import { ChartPeriodSelector } from "../components/charts/ChartPeriodSelector";
import { ChartViewportControls } from "../components/charts/ChartViewportControls";
import { filterChartDataWithBuffer, strictPeriodBounds, inferChartPeriodFromSpan, formatChartAxisLabel, type ChartPeriod } from "../lib/chartTimeRange";
import type { ChartPeriodPickMode } from "../hooks/useBotPeriod";
import { useChartViewport } from "../hooks/useChartViewport";
import type { ChartPoint } from "../services/chartDataService";
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

export interface SimulationWorkspaceActions {
  onRunBacktest?: () => void
  onAnalyzeStep?: () => void
  backtestLoading?: boolean
  stepAnalyzing?: boolean
  backtestDone?: boolean
  stepSource?: 'backtest' | 'api' | null
  showBacktest?: boolean
}

export interface StrategySimulationWorkspaceProps {
  chartData: SimulationChartPoint[];
  /** Полная загруженная история для viewport (как fullData в графике пары). */
  chartFullData?: SimulationChartPoint[];
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
  chartPeriod?: ChartPeriod;
  onChartPeriodChange?: (period: ChartPeriod) => void;
  /** Панель Player (scrubber, play/pause). В live-торговле — выключить. */
  showPlayer?: boolean
  simulationActions?: SimulationWorkspaceActions
  chartToolbar?: React.ReactNode
  stepLoading?: boolean
  stepError?: string | null
  onStepRecalc?: () => void
  /** When true, backtest toolbar is shown in a collapsible panel. */
  collapsibleBacktestPanel?: boolean
  /** Backtest period pick on chart: first short click = start, second = end. */
  chartPeriodPickMode?: ChartPeriodPickMode
  onChartPeriodPick?: (time: number) => void
  /** Short click on chart (when not picking period) — inspect step at nearest timestamp. */
  onChartStepInspect?: (time: number) => void
  /** Vertical marker at the inspected step (epoch ms). */
  selectedStepTime?: number | null
  /** Time ranges to highlight as excluded from calculations. */
  excludedRanges?: Array<{ start: number; end: number }>
}

type VisKey = string;
type TradeEventHint = { type: "Buy" | "Sell" | "Error" };

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

const CHART_OUTER_PADDING = { top: 8, right: 16, bottom: 8, left: 8 };
/** Must match axes.y.thickness in agChartOptions — used for click/hover ↔ plot mapping. */
const CHART_Y_AXIS_THICKNESS = 52;
/** Must match axes.x.thickness in agChartOptions. */
const CHART_X_AXIS_THICKNESS = 28;
const CHART_CLICK_MOVE_THRESHOLD_PX = 5;

function getChartPlotInsets() {
  return {
    top: CHART_OUTER_PADDING.top,
    right: CHART_OUTER_PADDING.right,
    bottom: CHART_OUTER_PADDING.bottom + CHART_X_AXIS_THICKNESS,
    left: CHART_OUTER_PADDING.left + CHART_Y_AXIS_THICKNESS,
  };
}

function timestampAtChartClientX(
  clientX: number,
  rect: DOMRect,
  xDomain: [number, number],
  visibleData: readonly { t: number }[],
): number | null {
  const insets = getChartPlotInsets();
  const plotWidth = Math.max(1, rect.width - insets.left - insets.right);
  const xRaw = clientX - rect.left;
  const xClamped = Math.min(insets.left + plotWidth, Math.max(insets.left, xRaw));
  const ratio = (xClamped - insets.left) / plotWidth;
  const tsAtCursor = xDomain[0] + ratio * (xDomain[1] - xDomain[0]);
  const point = findNearestPointByTime(visibleData, tsAtCursor);
  return point?.t ?? null;
}

function timestampToPlotClientX(
  ts: number,
  rect: DOMRect,
  xDomain: [number, number],
): number | null {
  const insets = getChartPlotInsets();
  const plotWidth = Math.max(1, rect.width - insets.left - insets.right);
  const span = xDomain[1] - xDomain[0];
  if (!Number.isFinite(span) || span <= 0) return null;
  const ratio = (ts - xDomain[0]) / span;
  if (ratio < 0 || ratio > 1) return null;
  return insets.left + ratio * plotWidth;
}

function findNearestPointByTime<T extends { t: number }>(points: readonly T[], targetTs: number): T | null {
  if (points.length === 0) return null;
  let best = points[0];
  let bestDist = Math.abs(best.t - targetTs);
  for (let i = 1; i < points.length; i += 1) {
    const dist = Math.abs(points[i].t - targetTs);
    if (dist < bestDist) {
      best = points[i];
      bestDist = dist;
    }
  }
  return best;
}

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
  chartFullData,
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
  chartPeriod,
  onChartPeriodChange,
  showPlayer = true,
  simulationActions,
  chartToolbar,
  stepLoading = false,
  stepError = null,
  onStepRecalc,
  collapsibleBacktestPanel = false,
  chartPeriodPickMode = 'idle',
  onChartPeriodPick,
  onChartStepInspect,
  selectedStepTime = null,
  excludedRanges = [],
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
  const [hoverCrosshair, setHoverCrosshair] = useState<HoverCrosshair | null>(null);
  const [chartInspectTime, setChartInspectTime] = useState<number | null>(null);

  const effectiveSelectedStepTime = selectedStepTime ?? chartInspectTime;

  const showInitialChartLoading = loading && chartData.length === 0;

  useEffect(() => {
    setHoverCrosshair(null);
  }, [chartData.length, chartData[chartData.length - 1]?.t]);

  useEffect(() => {
    if (!loading) setHoverCrosshair(null);
  }, [loading]);

  const filterRef = useRef<HTMLDivElement>(null);
  const logListRef = useRef<HTMLDivElement>(null);
  const eventPanelScrollRef = useRef<HTMLDivElement>(null);
  const eventPanelHeaderRef = useRef<HTMLDivElement>(null);
  const stepResultSectionRef = useRef<HTMLDivElement>(null);
  const eventsControlsSectionRef = useRef<HTMLDivElement>(null);
  const chartPanelRef = useRef<HTMLDivElement>(null);
  const logPrevMetricsRef = useRef<{ length: number; scrollHeight: number }>({ length: 0, scrollHeight: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playIdxRef = useRef(playIdx);
  const eventResizeStartXRef = useRef(0);
  const eventResizeStartWidthRef = useRef(280);
  const playerResizeStartYRef = useRef(0);
  const playerResizeStartHeightRef = useRef(128);
  const stepResizeStartYRef = useRef(0);
  const stepResizeStartHeightRef = useRef(STEP_RESULT_DEFAULT_HEIGHT_PX);
  const chartPickPendingRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const chartPickDragStartedRef = useRef(false);
  const onChartPeriodPickRef = useRef(onChartPeriodPick);
  const onChartStepInspectRef = useRef(onChartStepInspect);
  onChartPeriodPickRef.current = onChartPeriodPick;
  onChartStepInspectRef.current = onChartStepInspect;

  playIdxRef.current = playIdx;

  const dataSpanMs = useMemo(() => {
    const base = chartFullData && chartFullData.length > 0 ? chartFullData : chartData;
    if (base.length < 2) return 0;
    return base[base.length - 1].t - base[0].t;
  }, [chartData, chartFullData]);

  const effectiveChartPeriod: ChartPeriod = useMemo(
    () => (chartPeriod !== undefined ? chartPeriod : inferChartPeriodFromSpan(dataSpanMs)),
    [chartPeriod, dataSpanMs],
  );

  const playHeadTs = useMemo(() => {
    if (chartData.length === 0) return undefined;
    const headIdx = Math.max(0, Math.min(Math.max(playIdx, 1), chartData.length) - 1);
    return chartData[headIdx]?.t;
  }, [chartData, playIdx]);

  const chartSource = useMemo(() => {
    const base = chartFullData && chartFullData.length > 0 ? chartFullData : chartData;
    if (playHeadTs === undefined) return base;
    return base.filter((point) => point.t <= playHeadTs);
  }, [chartFullData, chartData, playHeadTs]);

  const periodData = useMemo(() => {
    const source = chartSource as ChartPoint[];
    if (chartPeriod !== undefined) {
      return filterChartDataWithBuffer(source, effectiveChartPeriod);
    }
    return source;
  }, [chartSource, chartPeriod, effectiveChartPeriod]);
  const clampBounds = useMemo(() => {
    const source = chartSource as ChartPoint[];
    if (source.length === 0) {
      return strictPeriodBounds(source, effectiveChartPeriod);
    }
    if (chartPeriod !== undefined) {
      return strictPeriodBounds(source, effectiveChartPeriod);
    }
    return { min: source[0].t, max: source[source.length - 1].t };
  }, [chartSource, chartPeriod, effectiveChartPeriod]);
  const {
    visibleData: viewportVisibleData,
    renderData: viewportRenderData,
    xDomain,
    isAdjusted: isViewportAdjusted,
    reset: resetViewport,
    centerOnTimestamp,
    zoomByButton,
    panByButton,
    handleWheel,
    handlePanStart,
  } = useChartViewport(periodData, effectiveChartPeriod, clampBounds, {
    containerRef: chartPanelRef,
  });
  const visibleData = useMemo(() => {
    const source = viewportRenderData.length > 0 ? viewportRenderData : viewportVisibleData;
    return source as SimulationChartPoint[];
  }, [viewportRenderData, viewportVisibleData]);
  const maxIdx = chartData.length;

  const selectedStepCrossLines = useMemo(() => {
    if (effectiveSelectedStepTime == null) return undefined;
    return [
      {
        type: "line" as const,
        value: effectiveSelectedStepTime,
        stroke: "#F5C400",
        lineDash: [4, 3],
        strokeWidth: 1,
        label: { enabled: false },
      },
    ];
  }, [effectiveSelectedStepTime]);

  const excludedRangesCrossLines = useMemo(() => {
    if (excludedRanges.length === 0) return [];
    return excludedRanges
      .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end))
      .map((range) => ({
        type: "range" as const,
        range: [Math.min(range.start, range.end), Math.max(range.start, range.end)] as [number, number],
        fill: "#E5383B",
        fillOpacity: 0.2,
        strokeWidth: 0,
        label: { enabled: false },
      }));
  }, [excludedRanges]);

  const chartCrossLines = useMemo(() => {
    const stepLine = selectedStepCrossLines ?? [];
    if (excludedRangesCrossLines.length === 0) return stepLine.length > 0 ? stepLine : undefined;
    return [...excludedRangesCrossLines, ...stepLine];
  }, [excludedRangesCrossLines, selectedStepCrossLines]);

  useEffect(() => {
    if (chartData.length === 0) setChartInspectTime(null);
  }, [chartData.length]);

  useEffect(() => {
    if (chartPeriod === undefined) return;
    resetViewport();
  }, [chartPeriod, resetViewport]);

  useEffect(() => {
    if (chartPeriod !== undefined) return;
    resetViewport();
  }, [chartData.length, chartData[0]?.t, chartData[chartData.length - 1]?.t, chartPeriod, resetViewport]);

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
  const timelineLastTs = chartSource.length > 0 ? chartSource[chartSource.length - 1].t : -1;

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

  /** Same as a short chart click: vertical inspect marker only, viewport unchanged. */
  const inspectEventPoint = (event: SimulationLogEvent) => {
    const targetIdx = Math.max(0, Math.min(chartData.length - 1, event.dataIdx));
    const ts = event.markerTs ?? chartData[targetIdx]?.t;
    if (typeof ts === "number" && Number.isFinite(ts)) {
      setChartInspectTime(ts);
      onChartStepInspectRef.current?.(ts);
    }
  };

  /** Explicit “go to point”: moves playhead and pans chart (EventExplainPanel button). */
  const jumpToEventPoint = (event: SimulationLogEvent) => {
    const targetIdx = Math.max(0, Math.min(chartData.length - 1, event.dataIdx));
    onPlayIdxChange(Math.min(chartData.length, targetIdx + 1));
    setIsPlaying(false);
    const ts = event.markerTs ?? chartData[targetIdx]?.t;
    if (typeof ts === "number" && Number.isFinite(ts)) {
      setChartInspectTime(ts);
      onChartStepInspectRef.current?.(ts);
      if (isViewportAdjusted) centerOnTimestamp(ts);
    }
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

  const handleChartMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button")) return;
    setHoverCrosshair(null);

    const wantsPeriodPick = chartPeriodPickMode !== "idle" && onChartPeriodPickRef.current;
    const wantsStepInspect = chartPeriodPickMode === "idle" && onChartStepInspectRef.current;

    if (wantsPeriodPick || wantsStepInspect) {
      chartPickPendingRef.current = { clientX: e.clientX, clientY: e.clientY };
      chartPickDragStartedRef.current = false;
      return;
    }

    handlePanStart(e);
  };

  const handleChartMouseMoveWithPick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const pending = chartPickPendingRef.current;
    if (pending && !chartPickDragStartedRef.current) {
      const dx = e.clientX - pending.clientX;
      const dy = e.clientY - pending.clientY;
      if (Math.hypot(dx, dy) > CHART_CLICK_MOVE_THRESHOLD_PX) {
        chartPickDragStartedRef.current = true;
        handlePanStart({
          ...e,
          clientX: pending.clientX,
          clientY: pending.clientY,
          button: 0,
          preventDefault: () => {},
        });
      }
    }
    handleChartMouseMove(e);
  };

  useEffect(() => {
    const onMouseUp = () => {
      const pending = chartPickPendingRef.current;
      if (pending && !chartPickDragStartedRef.current) {
        const panel = chartPanelRef.current;
        const onPeriodPick = onChartPeriodPickRef.current;
        const onStepInspect = onChartStepInspectRef.current;
        if (panel && visibleData.length > 0) {
          const ts = timestampAtChartClientX(
            pending.clientX,
            panel.getBoundingClientRect(),
            xDomain,
            visibleData,
          );
          if (ts != null) {
            if (chartPeriodPickMode !== "idle" && onPeriodPick) {
              onPeriodPick(ts);
            } else if (chartPeriodPickMode === "idle" && onStepInspect) {
              setChartInspectTime(ts);
              onStepInspect(ts);
              setEventPanelCollapsed(false);
            }
          }
        }
      }
      chartPickPendingRef.current = null;
      chartPickDragStartedRef.current = false;
    };
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [chartPeriodPickMode, visibleData, xDomain]);

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

  const hasMeaningfulAvg = useMemo(
    () => visibleData.some((point) => typeof point.avg === "number" && point.avg > 0),
    [visibleData],
  );

  const hasRenderableSeries = useMemo(() => {
    if (visibility.avg && hasMeaningfulAvg) return true;
    return networks.some((net) => visibility[`${net.id}_buy`] || visibility[`${net.id}_sell`]);
  }, [visibility, networks, hasMeaningfulAvg]);

  const hoverYDomain = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const pushValue = (value: unknown) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      if (value < min) min = value;
      if (value > max) max = value;
    };
    for (const point of visibleData) {
      if (visibility.avg && typeof point.avg === "number" && point.avg > 0) pushValue(point.avg);
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
    if (loading || visibleData.length === 0 || !hasRenderableSeries) {
      setHoverCrosshair(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const insets = getChartPlotInsets();
    const plotWidth = Math.max(1, rect.width - insets.left - insets.right);
    const plotHeight = Math.max(1, rect.height - insets.top - insets.bottom);
    const xRaw = e.clientX - rect.left;
    const xClamped = Math.min(insets.left + plotWidth, Math.max(insets.left, xRaw));
    const ratio = (xClamped - insets.left) / plotWidth;
    const tsAtCursor = xDomain[0] + ratio * (xDomain[1] - xDomain[0]);
    const point = findNearestPointByTime(visibleData, tsAtCursor);
    if (!point) {
      setHoverCrosshair(null);
      return;
    }

    let price: number | null = null;
    if (visibility.avg && typeof point.avg === "number" && Number.isFinite(point.avg) && point.avg > 0) {
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
    const yPx = insets.top + (1 - Math.min(1, Math.max(0, yRatio))) * plotHeight;
    const xPx = timestampToPlotClientX(point.t, rect, xDomain);
    if (xPx == null) {
      setHoverCrosshair(null);
      return;
    }
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
      xPx,
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
      if (typeof y !== "number" || !Number.isFinite(y) || y <= 0) {
        const nearest = chartData[ev.dataIdx];
        if (ev.type === "Buy") {
          y = typeof nearest?.[`${networks[0]?.id}_buy`] === "number" ? Number(nearest[`${networks[0]?.id}_buy`]) : undefined;
        } else if (ev.type === "Sell") {
          y = typeof nearest?.[`${networks[0]?.id}_sell`] === "number" ? Number(nearest[`${networks[0]?.id}_sell`]) : undefined;
        }
        if ((typeof y !== "number" || !Number.isFinite(y) || y <= 0) && nearest) {
          const avg = nearest.avg;
          if (typeof avg === "number" && avg > 0) y = avg;
        }
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

    if (visibility.avg && hasMeaningfulAvg) {
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
        tooltip: { enabled: false },
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
          tooltip: { enabled: false },
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
          tooltip: { enabled: false },
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
        tooltip: { enabled: false },
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
        tooltip: { enabled: false },
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
        tooltip: { enabled: false },
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
          enabled: false,
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
      tooltip: { enabled: false },
      legend: { enabled: false },
      background: { fill: "transparent" },
      padding: CHART_OUTER_PADDING,
      series,
      axes: {
        x: {
          type: "number",
          position: "bottom",
          thickness: CHART_X_AXIS_THICKNESS,
          min: xDomain[0],
          max: xDomain[1],
          line: { stroke: chartAxisColor },
          tick: { stroke: chartAxisColor },
          label: {
            color: chartTickColor,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            formatter: (params: { value?: unknown }) => {
              const ts = Number(params?.value);
              if (!Number.isFinite(ts)) return "";
              return formatChartAxisLabel(ts, effectiveChartPeriod);
            },
          },
          crossLines: chartCrossLines,
          crosshair: { enabled: false },
          gridLine: { enabled: false },
        },
        y: {
          type: "number",
          position: "left",
          thickness: CHART_Y_AXIS_THICKNESS,
          line: { stroke: chartAxisColor },
          tick: { stroke: chartAxisColor },
          label: {
            color: chartTickColor,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            formatter: (params: { value: number }) => Number(params.value).toFixed(0),
          },
          crosshair: { enabled: false },
          gridLine: { enabled: true, style: [{ stroke: chartGridColor, lineDash: [2, 4] }] },
        },
      },
    };
  }, [
    chartRenderData,
    xDomain,
    visibility,
    hasMeaningfulAvg,
    networks,
    tradingNetworkIds,
    averageLineColor,
    chartAxisColor,
    chartTickColor,
    chartGridColor,
    tradeMarkerData,
    tradeExecutionBands,
    isDark,
    effectiveChartPeriod,
    chartCrossLines,
  ]);

  const agChartSafeOptions = useMemo(() => {
    const data = visibleData
      .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.avg))
      .map((point) => ({ t: Number(point.t), avg: Number(point.avg) }));
    return {
      data,
      animation: { enabled: false },
      tooltip: { enabled: false },
      legend: { enabled: false },
      background: { fill: "transparent" },
      padding: CHART_OUTER_PADDING,
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
          position: "bottom",
          thickness: CHART_X_AXIS_THICKNESS,
          min: xDomain[0],
          max: xDomain[1],
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
          crossLines: chartCrossLines,
          crosshair: { enabled: false },
          gridLine: { enabled: false },
        },
        y: {
          type: "number",
          position: "left",
          thickness: CHART_Y_AXIS_THICKNESS,
          line: { stroke: chartAxisColor },
          tick: { stroke: chartAxisColor },
          label: {
            color: chartTickColor,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            formatter: (params: { value: number }) => Number(params.value).toFixed(0),
          },
          crosshair: { enabled: false },
          gridLine: { enabled: true, style: [{ stroke: chartGridColor, lineDash: [2, 4] }] },
        },
      },
    };
  }, [visibleData, averageLineColor, stepLineInterpolation, chartAxisColor, chartTickColor, chartGridColor, isDark, xDomain, chartCrossLines]);

  const [backtestPanelOpen, setBacktestPanelOpen] = useState(false);

  const lastPriceDisplay = header.lastPrice ?? "—";

  const backtestPanelContent = (chartToolbar || simulationActions) ? (
    <>
      {chartToolbar ? <div className="mb-2">{chartToolbar}</div> : null}
      {simulationActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {simulationActions.showBacktest !== false && simulationActions.onRunBacktest && (
            <button
              type="button"
              onClick={simulationActions.onRunBacktest}
              disabled={simulationActions.backtestLoading}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              style={{
                border: `1px solid ${accent}`,
                color: '#fff',
                backgroundColor: accent,
              }}
              data-testid="run-backtest"
            >
              {simulationActions.backtestLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              Запустить бэктест
            </button>
          )}
          {simulationActions.onAnalyzeStep && (
            <button
              type="button"
              onClick={simulationActions.onAnalyzeStep}
              disabled={simulationActions.stepAnalyzing || playIdx <= 0}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{
                border: `1px solid ${borderColor}`,
                color: textPrimary,
                backgroundColor: isDark ? '#111722' : '#FFFFFF',
              }}
              data-testid="analyze-step"
            >
              {simulationActions.stepAnalyzing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <SkipForward size={14} />
              )}
              Анализ шага
            </button>
          )}
          {simulationActions.stepSource && (
            <span style={{ fontSize: '11px', color: textSecondary, fontFamily: 'var(--font-mono)' }}>
              {simulationActions.stepSource === 'backtest' ? 'из бэктеста' : 'через API'}
            </span>
          )}
          {simulationActions.backtestDone === false && (
            <span style={{ fontSize: '11px', color: textSecondary }}>
              Сначала загрузятся котировки, затем запустите бэктест
            </span>
          )}
        </div>
      ) : null}
    </>
  ) : null;

  return (
    <div className={`flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden ${className ?? ""}`}>
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        style={{ borderRight: `1px solid ${borderColor}` }}
      >
        <div className="px-4 pt-3 pb-2 shrink-0" style={{ borderBottom: `1px solid ${borderColor}` }}>
          {backtestPanelContent && (
            collapsibleBacktestPanel ? (
              <div
                className="mb-3 rounded-lg overflow-visible"
                style={{
                  border: `1px solid ${accent}40`,
                  backgroundColor: isDark ? `${accent}12` : `${accent}08`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setBacktestPanelOpen((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold"
                  style={{ color: textPrimary }}
                  aria-expanded={backtestPanelOpen}
                  data-testid="backtest-panel-toggle"
                >
                  {backtestPanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>Бэктест и настройки</span>
                  {simulationActions?.backtestLoading && (
                    <Loader2 size={12} className="animate-spin ml-auto" style={{ color: textSecondary }} />
                  )}
                  {!backtestPanelOpen && simulationActions?.backtestDone && (
                    <span className="ml-auto text-[10px] font-normal" style={{ color: textSecondary }}>
                      бэктест выполнен
                    </span>
                  )}
                </button>
                {backtestPanelOpen && (
                  <div className="border-t px-3 py-2.5" style={{ borderColor: `${accent}30` }}>
                    {backtestPanelContent}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="mb-3 rounded-lg px-3 py-2.5"
                style={{
                  border: `1px solid ${accent}40`,
                  backgroundColor: isDark ? `${accent}12` : `${accent}08`,
                }}
              >
                {backtestPanelContent}
              </div>
            )
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "14px", fontWeight: 600, color: textPrimary }}>{header.pairLabel}</span>
              <span style={{ fontSize: "11px", color: textSecondary }}>{header.networksLabel}</span>
              {header.badge}
              {loading && <Loader2 size={12} className="animate-spin" style={{ color: textSecondary }} />}
              {error && (
                <span style={{ fontSize: "11px", color: "#E5383B" }} title={error}>
                  {error.length > 48 ? `${error.slice(0, 48)}…` : error}
                </span>
              )}
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

          {chartPeriod !== undefined && onChartPeriodChange ? (
            <ChartPeriodSelector
              period={chartPeriod}
              onChange={onChartPeriodChange}
              onReset={resetViewport}
              showReset={isViewportAdjusted}
              className="mt-2"
            />
          ) : null}
        </div>

        <div
          ref={chartPanelRef}
          className={`relative min-h-0 w-full flex-1 select-none touch-none overscroll-none ${
            chartPeriodPickMode !== "idle" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
          }`}
          style={{ minWidth: 0 }}
          onWheel={handleWheel}
          onMouseDown={handleChartMouseDown}
          onMouseMove={handleChartMouseMoveWithPick}
          onMouseLeave={() => setHoverCrosshair(null)}
        >
          {showInitialChartLoading ? (
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
              {hoverCrosshair && !loading && (
                <>
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${hoverCrosshair.xPx}px`,
                      top: `${getChartPlotInsets().top}px`,
                      height: `calc(100% - ${getChartPlotInsets().top + getChartPlotInsets().bottom}px)`,
                      borderLeft: `1px dashed ${isDark ? "#9FB1C7AA" : "#334155AA"}`,
                    }}
                  />
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${getChartPlotInsets().left}px`,
                      right: `${getChartPlotInsets().right}px`,
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
                      top: `${getChartPlotInsets().top + 8}px`,
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
          <div
            className="absolute top-3 right-3 z-20"
            onMouseEnter={() => setHoverCrosshair(null)}
            onMouseMove={(e) => {
              e.stopPropagation();
              setHoverCrosshair(null);
            }}
          >
            <ChartViewportControls
              variant="simulation"
              panelBg={panelBg}
              borderColor={borderColor}
              textSecondary={textSecondary}
              onZoomOut={() => zoomByButton(false)}
              onZoomIn={() => zoomByButton(true)}
              onPanLeft={() => panByButton(-1)}
              onPanRight={() => panByButton(1)}
              onToggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
            />
          </div>
        </div>

        {showPlayer ? (
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
        ) : null}
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
                loading={stepLoading}
                error={stepError}
                source={simulationActions?.stepSource ?? null}
                onRecalc={onStepRecalc}
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
              const eventTs = event.markerTs ?? chartData[event.dataIdx]?.t;
              const isActivePoint =
                effectiveSelectedStepTime != null &&
                typeof eventTs === "number" &&
                eventTs === effectiveSelectedStepTime;
              return (
                <div key={event.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <div
                    className="px-3 py-2 flex items-start gap-2.5 transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isExpanded || isActivePoint ? surfaceBg : "transparent",
                      boxShadow: isActivePoint ? `inset 2px 0 0 ${accent}` : undefined,
                    }}
                    onClick={() => inspectEventPoint(event)}
                    onMouseEnter={(e) => {
                      if (!isExpanded && !isActivePoint) {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = surfaceBg;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isExpanded && !isActivePoint) {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                      }
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
                      <span
                        style={{ color: textSecondary, paddingTop: "2px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedEvent(isExpanded ? null : event.id);
                        }}
                      >
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
