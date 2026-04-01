import { createFeatureSelector, createSelector } from '@ngrx/store';
import { DemoAccountState } from '../../../shared/models';
import { DEMO_ACCOUNT_FEATURE_KEY } from './demo-account.reducer';

export const selectDemoAccountState =
  createFeatureSelector<DemoAccountState>(DEMO_ACCOUNT_FEATURE_KEY);

export const selectUsdcBalance = createSelector(
  selectDemoAccountState,
  (s) => s.usdcBalance,
);

export const selectWethBalance = createSelector(
  selectDemoAccountState,
  (s) => s.wethBalance,
);

export const selectInitialUsdc = createSelector(
  selectDemoAccountState,
  (s) => s.initialUsdc,
);

export const selectDemoTradeHistory = createSelector(
  selectDemoAccountState,
  (s) => s.tradeHistory,
);

export const selectDemoLoading = createSelector(
  selectDemoAccountState,
  (s) => s.loading,
);

/** P&L в USDC — текущий портфель минус начальный вклад */
export const selectDemoPnl = createSelector(
  selectDemoAccountState,
  (s) => {
    // P&L будет рассчитан на уровне компонента с учётом текущей цены
    return { usdcBalance: s.usdcBalance, wethBalance: s.wethBalance, initialUsdc: s.initialUsdc };
  },
);

