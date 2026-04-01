import { demoAccountReducer, initialDemoAccountState } from './demo-account.reducer';
import {
  setInitialBalance,
  executeSwap,
  executeSwapSuccess,
  resetDemoAccount,
} from './demo-account.actions';
import { DemoTrade } from '../../../shared/models';

describe('DemoAccount Reducer', () => {
  it('should return initial state', () => {
    const state = demoAccountReducer(undefined, { type: 'NOOP' } as any);
    expect(state).toEqual(initialDemoAccountState);
    expect(state.usdcBalance).toBe(100);
    expect(state.wethBalance).toBe(0);
  });

  it('should set initial balance and reset history', () => {
    const state = demoAccountReducer(
      initialDemoAccountState,
      setInitialBalance({ usdc: 500 }),
    );
    expect(state.usdcBalance).toBe(500);
    expect(state.wethBalance).toBe(0);
    expect(state.initialUsdc).toBe(500);
    expect(state.tradeHistory).toEqual([]);
  });

  it('should set loading on executeSwap', () => {
    const state = demoAccountReducer(
      initialDemoAccountState,
      executeSwap({ direction: 'USDC_TO_WETH', amountIn: 100, slippage: 0.0001, price: 3000 }),
    );
    expect(state.loading).toBeTrue();
  });

  it('should apply USDC_TO_WETH swap correctly', () => {
    const trade: DemoTrade = {
      id: 1,
      direction: 'USDC_TO_WETH',
      amountIn: 100,
      tokenIn: 'USDC',
      amountOut: 0.03333,
      tokenOut: 'WETH',
      price: 3000,
      slippage: 0.0001,
      timestamp: Date.now(),
    };

    const state = demoAccountReducer(
      { ...initialDemoAccountState, loading: true },
      executeSwapSuccess({ trade }),
    );

    expect(state.usdcBalance).toBe(0);
    expect(state.wethBalance).toBeCloseTo(0.03333, 5);
    expect(state.loading).toBeFalse();
    expect(state.tradeHistory.length).toBe(1);
    expect(state.tradeHistory[0].direction).toBe('USDC_TO_WETH');
  });

  it('should apply WETH_TO_USDC swap correctly', () => {
    const trade: DemoTrade = {
      id: 2,
      direction: 'WETH_TO_USDC',
      amountIn: 0.03333,
      tokenIn: 'WETH',
      amountOut: 99.99,
      tokenOut: 'USDC',
      price: 3000,
      slippage: 0.0001,
      timestamp: Date.now(),
    };

    const prevState = {
      ...initialDemoAccountState,
      usdcBalance: 0,
      wethBalance: 0.03333,
      loading: true,
    };

    const state = demoAccountReducer(prevState, executeSwapSuccess({ trade }));

    expect(state.usdcBalance).toBeCloseTo(99.99, 2);
    expect(state.wethBalance).toBe(0);
    expect(state.loading).toBeFalse();
  });

  it('should reset to initial state', () => {
    const modifiedState = {
      ...initialDemoAccountState,
      usdcBalance: 0,
      wethBalance: 0.5,
      tradeHistory: [{ id: 1 } as DemoTrade],
    };

    const state = demoAccountReducer(modifiedState, resetDemoAccount());
    expect(state).toEqual(initialDemoAccountState);
  });

  it('should prepend trades to history', () => {
    const trade1: DemoTrade = {
      id: 1, direction: 'USDC_TO_WETH', amountIn: 50, tokenIn: 'USDC',
      amountOut: 0.016, tokenOut: 'WETH', price: 3000, slippage: 0.0001, timestamp: 1000,
    };
    const trade2: DemoTrade = {
      id: 2, direction: 'WETH_TO_USDC', amountIn: 0.016, tokenIn: 'WETH',
      amountOut: 48, tokenOut: 'USDC', price: 3000, slippage: 0.0001, timestamp: 2000,
    };

    let state = demoAccountReducer(initialDemoAccountState, executeSwapSuccess({ trade: trade1 }));
    state = demoAccountReducer(state, executeSwapSuccess({ trade: trade2 }));

    expect(state.tradeHistory.length).toBe(2);
    expect(state.tradeHistory[0].id).toBe(2); // newest first
    expect(state.tradeHistory[1].id).toBe(1);
  });
});

