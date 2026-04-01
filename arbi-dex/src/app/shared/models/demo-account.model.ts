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
}

/** Состояние демо-аккаунта */
export interface DemoAccountState {
  usdcBalance: number;
  wethBalance: number;
  initialUsdc: number;
  tradeHistory: DemoTrade[];
  loading: boolean;
}

