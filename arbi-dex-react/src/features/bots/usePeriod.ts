import { useEffect, useState } from 'react';
import { api } from '../../api';

/** A timestamp is in ms when it is far larger than any plausible epoch-seconds value. */
const isMsUnit = (t: number): boolean => t > 1e12;

/**
 * Manages a backtest/autotune period `[from, to]` for a bot: loads the available
 * history bounds, defaults to the last week, and exposes preset/date helpers.
 * The time unit (seconds vs ms) is detected from the loaded bounds so the same
 * control works regardless of the backend's data unit.
 */
export function usePeriod(botId: string) {
  const [range, setRange] = useState<{ historyFrom: number; historyTo: number } | null>(null);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    api.bots
      .historyRange(botId)
      .then((r) => {
        if (!alive) return;
        setRange(r);
        const week = isMsUnit(r.historyTo) ? 7 * 24 * 3600 * 1000 : 7 * 24 * 3600;
        setTo(r.historyTo);
        setFrom(Math.max(r.historyFrom, r.historyTo - week));
      })
      .catch(() => {
        /* history unavailable — the caller falls back to the server default period */
      });
    return () => {
      alive = false;
    };
  }, [botId]);

  const unitMs = isMsUnit(range?.historyTo ?? 0);
  const WEEK = unitMs ? 7 * 24 * 3600 * 1000 : 7 * 24 * 3600;
  const MONTH = Math.round(WEEK * (30 / 7));

  const setPreset = (span: number | 'all'): void => {
    if (!range) return;
    if (span === 'all') {
      setFrom(range.historyFrom);
      setTo(range.historyTo);
    } else {
      setTo(range.historyTo);
      setFrom(Math.max(range.historyFrom, range.historyTo - span));
    }
  };

  // Convert between the data's time unit and a `YYYY-MM-DD` date-input string.
  const toMs = (t: number): number => (unitMs ? t : t * 1000);
  const toData = (ms: number): number => (unitMs ? ms : Math.round(ms / 1000));
  const dateStr = (t: number | null): string => (t == null ? '' : new Date(toMs(t)).toISOString().slice(0, 10));
  const parseDate = (str: string, endOfDay: boolean): number | null => {
    if (!str) return null;
    const ms = Date.parse(`${str}T${endOfDay ? '23:59:59' : '00:00:00'}Z`);
    return Number.isNaN(ms) ? null : toData(ms);
  };

  return { range, from, to, setFrom, setTo, setPreset, dateStr, parseDate, WEEK, MONTH };
}

export type PeriodState = ReturnType<typeof usePeriod>;
