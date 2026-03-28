import { createReducer, on } from '@ngrx/store';
import { AuthState } from '../../../shared/models';
import {
  connectWalletRequest,
  connectWalletSuccess,
  connectWalletFailure,
  logout,
} from './auth.actions';

export const AUTH_FEATURE_KEY = 'auth';

export const initialAuthState: AuthState = {
  walletAddress: null,
  walletProvider: null,
  isConnected: false,
  isAuthenticated: false,
  status: 'idle',
  error: null,
};

export const authReducer = createReducer(
  initialAuthState,

  on(connectWalletRequest, (state) => ({
    ...state,
    status: 'connecting' as const,
    error: null,
  })),

  on(connectWalletSuccess, (state, { walletInfo }) => ({
    ...state,
    walletAddress: walletInfo.address,
    walletProvider: walletInfo.provider,
    isConnected: true,
    isAuthenticated: true,
    status: 'connected' as const,
    error: null,
  })),

  on(connectWalletFailure, (state, { error }) => ({
    ...state,
    status: 'error' as const,
    error,
  })),

  on(logout, () => ({ ...initialAuthState })),
);

