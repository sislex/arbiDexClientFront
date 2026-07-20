import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  slicePrecomputedForPlayIdx,
  stepAnalysisToLogEvent,
  type PrecomputedSimulationPayload,
} from "../fixtures/precomputedSimulationTypes";
import { findPlayIdxByTimestamp } from "../lib/chartTimeRange";
import { DEFAULT_PLAYBACK_INTERVAL_MS, type SimulationLogEvent } from "./simulationViewerTypes";

export interface UsePrecomputedSimulationOptions {
  defaultPlayIdx?: number;
}

export interface UsePrecomputedSimulationResult {
  chartData: PrecomputedSimulationPayload["chartData"];
  playIdx: number;
  setPlayIdx: (idx: number | ((prev: number) => number)) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  events: SimulationLogEvent[];
  stepResult: SimulationLogEvent | null;
  inspectTime: number | null;
  inspectAtTime: (time: number) => void;
  /** Цена последней точки ряда (как в StrategyDetails), не текущего playIdx. */
  lastPrice: string;
}

export function usePrecomputedSimulation(
  payload: PrecomputedSimulationPayload,
  options: UsePrecomputedSimulationOptions = {},
): UsePrecomputedSimulationResult {
  const pointCount = payload.chartData.length;
  const initialPlayIdx = options.defaultPlayIdx ?? pointCount;

  const [playIdx, setPlayIdxState] = useState(initialPlayIdx);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pinnedStep, setPinnedStep] = useState<{ time: number; result: SimulationLogEvent | null } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playIdxRef = useRef(playIdx);

  playIdxRef.current = playIdx;

  const setPlayIdx = (next: number | ((prev: number) => number)) => {
    setPlayIdxState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      return Math.max(0, Math.min(resolved, pointCount));
    });
  };

  useEffect(() => {
    setPlayIdxState(options.defaultPlayIdx ?? pointCount);
    setIsPlaying(false);
  }, [payload, pointCount, options.defaultPlayIdx]);

  const { logEvents, currentStep } = useMemo(
    () => slicePrecomputedForPlayIdx(payload, playIdx),
    [payload, playIdx],
  );

  const events = logEvents as SimulationLogEvent[];
  const playIdxStepResult = currentStep
    ? (stepAnalysisToLogEvent(currentStep) as SimulationLogEvent)
    : null;
  const stepResult = pinnedStep?.result ?? playIdxStepResult;
  const inspectTime = pinnedStep?.time ?? null;

  useEffect(() => {
    setPinnedStep(null);
  }, [playIdx]);

  const inspectAtTime = useCallback(
    (time: number) => {
      const idx = findPlayIdxByTimestamp(payload.chartData, time);
      const { currentStep: step } = slicePrecomputedForPlayIdx(payload, idx);
      setPinnedStep({
        time,
        result: step ? (stepAnalysisToLogEvent(step) as SimulationLogEvent) : null,
      });
    },
    [payload],
  );

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPlaying || pointCount === 0) return;

    const delay = Math.max(16, Math.round(DEFAULT_PLAYBACK_INTERVAL_MS / Math.max(speed, 0.01)));
    intervalRef.current = setInterval(() => {
      const current = playIdxRef.current;
      if (current >= pointCount) {
        setIsPlaying(false);
        return;
      }
      setPlayIdxState(Math.min(current + 1, pointCount));
    }, delay);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, pointCount]);

  const lastPoint = payload.chartData[payload.chartData.length - 1];
  const lastPrice =
    typeof lastPoint?.avg === "number" ? lastPoint.avg.toFixed(2) : "—";

  return {
    chartData: payload.chartData,
    playIdx,
    setPlayIdx,
    isPlaying,
    setIsPlaying,
    speed,
    setSpeed,
    events,
    stepResult,
    inspectTime,
    inspectAtTime,
    lastPrice,
  };
}
