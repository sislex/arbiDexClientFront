import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './config';
import { getStoredAuth } from './http';
import { splitMarketId } from './live';
import type { AutotuneJob } from '../domain/types';

/** One live price tick from the `/live-chart` gateway. */
export interface MarketTick {
  field: 'bid' | 'ask';
  t: number; // ms timestamp
  v: number; // price
}

interface PriceUpdate {
  key: string; // e.g. "binance|ETH/USDT|bidPrice"
  point: { t: number; v: number };
}

/** WebSocket origin = API base without the trailing `/api`. */
function wsOrigin(): string {
  return (API_BASE_URL ?? '').replace(/\/api\/?$/, '');
}

function fieldFromKey(key: string): 'bid' | 'ask' | null {
  if (key.endsWith('askPrice')) return 'ask';
  if (key.endsWith('bidPrice')) return 'bid';
  return null;
}

/**
 * Subscribe to live price ticks for a market (sourceId+pairId) via the
 * `/live-chart` Socket.IO namespace. Returns an unsubscribe function.
 */
export function subscribeMarket(marketId: string, onTick: (tick: MarketTick) => void): () => void {
  const { sourceId, pairId } = splitMarketId(marketId);
  const token = getStoredAuth()?.accessToken;
  const socket: Socket = io(`${wsOrigin()}/live-chart`, {
    auth: { token },
    query: { sourceId, pairId },
    transports: ['websocket'],
    reconnection: true,
  });

  socket.on('priceUpdate', (msg: PriceUpdate) => {
    const field = fieldFromKey(msg.key);
    if (!field || !msg.point) return;
    onTick({ field, t: msg.point.t, v: msg.point.v });
  });

  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}

/**
 * Subscribe to background-autotune progress: the server pushes a job snapshot
 * (done/total + top-500 combos) every second via the `/autotune-progress`
 * namespace. Returns an unsubscribe function.
 */
export function subscribeAutotuneProgress(
  jobId: string,
  onProgress: (snapshot: AutotuneJob) => void,
): () => void {
  const token = getStoredAuth()?.accessToken;
  const socket: Socket = io(`${wsOrigin()}/autotune-progress`, {
    auth: { token },
    query: { jobId },
    transports: ['websocket'],
    reconnection: true,
  });
  socket.on('progress', onProgress);
  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}
