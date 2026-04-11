/** Направление обмена */
export type SwapDirection = 'USDC_TO_WETH' | 'WETH_TO_USDC';

/** Запись об одной сделке */
export interface DemoTrade {
  id: number;
  direction: SwapDirection;
  amountIn: number;
  tokenIn: string;
  amountOut: number;
  tokenOut: string;
  price: number;
  slippage: number;
  timestamp: number;
  /** Номер шага исторических данных, на котором произошла сделка */
  step?: number;
  /** Время из исторических данных (timestamp точки playback) */
  playbackTime?: number;
}

/** Состояние демо-аккаунта */
export interface DemoAccountState {
  usdcBalance: number;
  wethBalance: number;
  initialUsdc: number;
  tradeHistory: DemoTrade[];
  loading: boolean;
}

/** Режим торговли демо-аккаунта */
export type DemoTradeMode = 'live' | 'historical';

/** Скорости воспроизведения */
export const PLAYBACK_SPEEDS = [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** Состояние плеера исторических данных */
export interface PlaybackState {
  /** Воспроизводится ли сейчас */
  isPlaying: boolean;
  /** Текущая скорость воспроизведения */
  speed: PlaybackSpeed;
  /** Текущий timestamp воспроизведения */
  currentTime: number;
  /** Начальный timestamp данных */
  startTime: number;
  /** Конечный timestamp данных */
  endTime: number;
  /** Прогресс 0..1 */
  progress: number;
  /** Общее количество точек */
  totalPoints: number;
  /** Индекс текущей точки */
  currentIndex: number;
  /** Загружаются ли данные */
  loading: boolean;
  /** Ошибка */
  error: string;
}

