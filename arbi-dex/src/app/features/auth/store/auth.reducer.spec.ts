import { authReducer, initialAuthState } from './auth.reducer';
import {
  connectWalletRequest,
  connectWalletSuccess,
  connectWalletFailure,
  logout,
} from './auth.actions';
import { WalletProvider } from '../../../shared/models';

describe('authReducer', () => {
  it('should return initial state', () => {
    const state = authReducer(undefined, { type: '@@init' });
    expect(state).toEqual(initialAuthState);
  });

  it('should set status to connecting on connectWalletRequest', () => {
    const state = authReducer(
      initialAuthState,
      connectWalletRequest({ provider: WalletProvider.MetaMask }),
    );
    expect(state.status).toBe('connecting');
    expect(state.error).toBeNull();
  });

  it('should set wallet info on connectWalletSuccess', () => {
    const walletInfo = {
      address: '0x742d35Cc6634C0532925a3b8D4C9B8f3e4F4B3e',
      provider: WalletProvider.MetaMask,
    };
    const state = authReducer(
      initialAuthState,
      connectWalletSuccess({ walletInfo }),
    );
    expect(state.walletAddress).toBe(walletInfo.address);
    expect(state.walletProvider).toBe(WalletProvider.MetaMask);
    expect(state.isConnected).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.status).toBe('connected');
  });

  it('should set error on connectWalletFailure', () => {
    const state = authReducer(
      initialAuthState,
      connectWalletFailure({ error: 'User rejected' }),
    );
    expect(state.status).toBe('error');
    expect(state.error).toBe('User rejected');
  });

  it('should reset to initial state on logout', () => {
    const connectedState = {
      walletAddress: '0xABC',
      walletProvider: WalletProvider.MetaMask,
      isConnected: true,
      isAuthenticated: true,
      status: 'connected' as const,
      error: null,
    };
    const state = authReducer(connectedState, logout());
    expect(state).toEqual(initialAuthState);
  });
});

