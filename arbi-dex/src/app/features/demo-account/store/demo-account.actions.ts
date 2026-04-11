import { createAction, props } from '@ngrx/store';
import { SwapDirection, DemoTrade } from '../../../shared/models';

// Установить начальный баланс (сброс)
export const setInitialBalance = createAction(
  '[DemoAccount] Set Initial Balance',
  props<{ usdc: number }>(),
);

// Исполнить своп
export const executeSwap = createAction(
  '[DemoAccount] Execute Swap',
  props<{ direction: SwapDirection; amountIn: number; slippage: number; price: number; step?: number; playbackTime?: number }>(),
);

export const executeSwapSuccess = createAction(
  '[DemoAccount] Execute Swap Success',
  props<{ trade: DemoTrade }>(),
);

// Сбросить аккаунт к начальным значениям
export const resetDemoAccount = createAction('[DemoAccount] Reset');

