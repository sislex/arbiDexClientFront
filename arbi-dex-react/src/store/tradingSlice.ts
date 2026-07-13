import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { AutotuneResult, BacktestResult, QuotePoint } from '../domain/types';
import { api } from '../api';
import type { Status } from './authSlice';

interface TradingState {
  quotes: QuotePoint[];
  quotesStatus: Status;
  /** Live streaming ticks appended on top of the base series. */
  liveTicks: QuotePoint[];
  streaming: boolean;
  backtest: BacktestResult | null;
  backtestStatus: Status;
  backtestError: string | null;
  autotune: AutotuneResult | null;
  autotuneStatus: Status;
  autotuneError: string | null;
}

/**
 * Pull the server's human message out of an http error. Accepts an `Error`, a
 * Redux `SerializedError` (plain object with `.message`) or a raw string, then
 * extracts the JSON `"message"` field the backend sends (falling back to the text).
 */
function errorMessage(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
        ? (err as { message: string }).message
        : String(err);
  const match = raw.match(/\{.*"message"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? raw;
}

const initialState: TradingState = {
  quotes: [],
  quotesStatus: 'idle',
  liveTicks: [],
  streaming: false,
  backtest: null,
  backtestStatus: 'idle',
  backtestError: null,
  autotune: null,
  autotuneStatus: 'idle',
  autotuneError: null,
};

export const fetchQuotes = createAsyncThunk(
  'trading/fetchQuotes',
  (params: { marketConfigId?: string; pairId?: string; count?: number; intervalSec?: number }) =>
    api.quotes.series(params),
);

export const runBacktest = createAsyncThunk(
  'trading/runBacktest',
  (params: { strategyConfigId: string; marketConfigId: string; from?: number; to?: number; initialBalance?: number; botId?: string }) =>
    api.backtest.run(params),
);

export const runAutotuneThunk = createAsyncThunk(
  'trading/runAutotune',
  (params: { strategyConfigId: string; marketConfigId: string; maxCombos?: number; from?: number; to?: number; botId?: string }) =>
    api.autotune.run(params),
);

const slice = createSlice({
  name: 'trading',
  initialState,
  reducers: {
    setStreaming: (s, a: PayloadAction<boolean>) => {
      s.streaming = a.payload;
    },
    pushTick: (s, a: PayloadAction<QuotePoint>) => {
      s.liveTicks.push(a.payload);
    },
    clearLive: (s) => {
      s.liveTicks = [];
      s.streaming = false;
    },
    clearBacktest: (s) => {
      s.backtest = null;
      s.backtestStatus = 'idle';
      s.backtestError = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchQuotes.pending, (s) => {
      s.quotesStatus = 'loading';
    });
    b.addCase(fetchQuotes.fulfilled, (s, a) => {
      s.quotesStatus = 'succeeded';
      s.quotes = a.payload;
    });
    b.addCase(runBacktest.pending, (s) => {
      s.backtestStatus = 'loading';
      s.backtestError = null;
    });
    b.addCase(runBacktest.fulfilled, (s, a) => {
      s.backtestStatus = 'succeeded';
      s.backtest = a.payload;
    });
    b.addCase(runBacktest.rejected, (s, a) => {
      s.backtestStatus = 'failed';
      s.backtestError = errorMessage(a.error);
    });
    b.addCase(runAutotuneThunk.pending, (s) => {
      s.autotuneStatus = 'loading';
      s.autotuneError = null;
    });
    b.addCase(runAutotuneThunk.fulfilled, (s, a) => {
      s.autotuneStatus = 'succeeded';
      s.autotune = a.payload;
    });
    b.addCase(runAutotuneThunk.rejected, (s, a) => {
      s.autotuneStatus = 'failed';
      s.autotuneError = errorMessage(a.error);
    });
  },
});

export const { setStreaming, pushTick, clearLive, clearBacktest } = slice.actions;
export const tradingReducer = slice.reducer;
