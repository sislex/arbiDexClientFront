import { useEffect, useState } from 'react';
import { api } from '../../api';

/** A timestamp is in ms when it is far larger than any plausible epoch-seconds value. */
const isMsUnit = (t: number): boolean => t > 1e12;

/**
 * Manages a backtest/autotune/analysis period `[from, to]`: loads the available
 * history bounds (of a bot's market or a market config), defaults to the last
 * week, and exposes preset/date helpers. The time unit (seconds vs ms) is
 * detected from the loaded bounds so the same control works regardless of the
 * backend's data unit.
 */
export function usePeriod(id: string | undefined, source: 'bot' | 'marketConfig' = 'bot') {
  const [range, setRange] = useState<{ historyFrom: number; historyTo: number } | null>(null);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (source === 'bot' ? api.bots.historyRange(id) : api.marketConfigs.historyRange(id))
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
  }, [id, source]);

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

  // Convert between the data's time unit and a local `YYYY-MM-DDTHH:mm`
  // datetime-local input string.
  const toMs = (t: number): number => (unitMs ? t : t * 1000);
  const toData = (ms: number): number => (unitMs ? ms : Math.round(ms / 1000));
  const pad = (n: number): string => String(n).padStart(2, '0');
  const dateStr = (t: number | null): string => {
    if (t == null) return '';
    const d = new Date(toMs(t));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  /** Parse a local datetime-local string, clamped to the available history. */
  const parseDate = (str: string): number | null => {
    if (!str) return null;
    const ms = Date.parse(str); // no zone suffix → parsed as local time
    if (Number.isNaN(ms)) return null;
    const t = toData(ms);
    if (!range) return t;
    return Math.min(Math.max(t, range.historyFrom), range.historyTo);
  };

  return { range, from, to, setFrom, setTo, setPreset, dateStr, parseDate, WEEK, MONTH };
}

export type PeriodState = ReturnType<typeof usePeriod>;
