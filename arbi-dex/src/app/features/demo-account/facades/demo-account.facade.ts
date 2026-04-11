import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { SwapDirection } from '../../../shared/models';
import {
  executeSwap,
  setInitialBalance,
  resetDemoAccount,
} from '../store/demo-account.actions';
import {
  selectUsdcBalance,
  selectWethBalance,
  selectInitialUsdc,
  selectDemoTradeHistory,
  selectDemoLoading,
} from '../store/demo-account.selectors';

@Injectable({ providedIn: 'root' })
export class DemoAccountFacade {
  private readonly store = inject(Store);

  readonly usdcBalance$ = this.store.select(selectUsdcBalance);
  readonly wethBalance$ = this.store.select(selectWethBalance);
  readonly initialUsdc$ = this.store.select(selectInitialUsdc);
  readonly tradeHistory$ = this.store.select(selectDemoTradeHistory);
  readonly loading$ = this.store.select(selectDemoLoading);

  swap(direction: SwapDirection, amountIn: number, slippage: number, price: number, step?: number, playbackTime?: number): void {
    this.store.dispatch(executeSwap({ direction, amountIn, slippage, price, step, playbackTime }));
  }

  setInitialBalance(usdc: number): void {
    this.store.dispatch(setInitialBalance({ usdc }));
  }

  reset(): void {
    this.store.dispatch(resetDemoAccount());
  }
}

