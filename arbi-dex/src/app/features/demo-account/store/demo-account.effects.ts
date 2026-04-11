import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map } from 'rxjs/operators';
import { DemoTrade } from '../../../shared/models';
import { executeSwap, executeSwapSuccess } from './demo-account.actions';

let tradeCounter = 0;

@Injectable()
export class DemoAccountEffects {
  private readonly actions$ = inject(Actions);

  /**
   * Эффект executeSwap$ — синхронно рассчитывает результат свопа
   * на основе переданной цены и slippage, и диспатчит success.
   *
   * Цену (mid-price) компонент передаёт в action — мы не ходим в бэкенд.
   */
  executeSwap$ = createEffect(() =>
    this.actions$.pipe(
      ofType(executeSwap),
      map(({ direction, amountIn, slippage, price, step, playbackTime }) => {
        let amountOut: number;
        let tokenIn: string;
        let tokenOut: string;

        if (direction === 'USDC_TO_WETH') {
          // Покупка WETH: тратим USDC, получаем WETH
          // Применяем slippage: получаем меньше (хуже цена)
          const effectivePrice = price * (1 + slippage);
          amountOut = amountIn / effectivePrice;
          tokenIn = 'USDC';
          tokenOut = 'WETH';
        } else {
          // Продажа WETH: тратим WETH, получаем USDC
          // Применяем slippage: получаем меньше USDC
          const effectivePrice = price * (1 - slippage);
          amountOut = amountIn * effectivePrice;
          tokenIn = 'WETH';
          tokenOut = 'USDC';
        }

        const trade: DemoTrade = {
          id: ++tradeCounter,
          direction,
          amountIn,
          tokenIn,
          amountOut: parseFloat(amountOut.toFixed(8)),
          tokenOut,
          price,
          slippage,
          timestamp: Date.now(),
          step,
          playbackTime,
        };

        return executeSwapSuccess({ trade });
      }),
    ),
  );
}

