import { createReducer, on } from '@ngrx/store';
import { DemoAccountState } from '../../../shared/models';
import {
  setInitialBalance,
  executeSwap,
  executeSwapSuccess,
  resetDemoAccount,
} from './demo-account.actions';

export const DEMO_ACCOUNT_FEATURE_KEY = 'demoAccount';

const DEFAULT_USDC = 100;

export const initialDemoAccountState: DemoAccountState = {
  usdcBalance: DEFAULT_USDC,
  wethBalance: 0,
  initialUsdc: DEFAULT_USDC,
  tradeHistory: [],
  loading: false,
};

export const demoAccountReducer = createReducer(
  initialDemoAccountState,

  on(setInitialBalance, (_state, { usdc }) => ({
    ...initialDemoAccountState,
    usdcBalance: usdc,
    initialUsdc: usdc,
  })),

  on(executeSwap, (state) => ({
    ...state,
    loading: true,
  })),

  on(executeSwapSuccess, (state, { trade }) => {
    const isUsdcToWeth = trade.direction === 'USDC_TO_WETH';
    return {
      ...state,
      usdcBalance: isUsdcToWeth
        ? state.usdcBalance - trade.amountIn
        : state.usdcBalance + trade.amountOut,
      wethBalance: isUsdcToWeth
        ? state.wethBalance + trade.amountOut
        : state.wethBalance - trade.amountIn,
      tradeHistory: [trade, ...state.tradeHistory],
      loading: false,
    };
  }),

  on(resetDemoAccount, () => ({ ...initialDemoAccountState })),
);

