import { WalletProvider } from './wallet.model';

export type AuthStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface AuthState {
  walletAddress: string | null;
  walletProvider: WalletProvider | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  status: AuthStatus;
  error: string | null;
}

