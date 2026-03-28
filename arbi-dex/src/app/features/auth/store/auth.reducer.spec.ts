import { authReducer, initialAuthState } from './auth.reducer';
import {
  connectWalletRequest,
  connectWalletSuccess,
  connectWalletFailure,
  restoreSession,
  logout,
} from './auth.actions';
import { WalletProvider, AuthResult } from '../../../shared/models';

const mockAuthResult: AuthResult = {
  walletInfo: {
    address: '0x742d35Cc6634C0532925a3b8D4C9B8f3e4F4B3e',
    provider: WalletProvider.MetaMask,
  },
  accessToken: 'test_access_token',
  refreshToken: 'test_refresh_token',
  userId: 'user-uuid-123',
};

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

  it('should set wallet info and tokens on connectWalletSuccess', () => {
    const state = authReducer(
      initialAuthState,
      connectWalletSuccess({ authResult: mockAuthResult }),
    );
    expect(state.walletAddress).toBe(mockAuthResult.walletInfo.address);
    expect(state.walletProvider).toBe(WalletProvider.MetaMask);
    expect(state.accessToken).toBe('test_access_token');
    expect(state.refreshToken).toBe('test_refresh_token');
    expect(state.userId).toBe('user-uuid-123');
    expect(state.isConnected).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.status).toBe('connected');
  });

  it('should restore session from stored data', () => {
    const state = authReducer(
      initialAuthState,
      restoreSession({ authResult: mockAuthResult }),
    );
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('test_access_token');
    expect(state.walletAddress).toBe(mockAuthResult.walletInfo.address);
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
    const connectedState = authReducer(
      initialAuthState,
      connectWalletSuccess({ authResult: mockAuthResult }),
    );
    const state = authReducer(connectedState, logout());
    expect(state).toEqual(initialAuthState);
  });
});

