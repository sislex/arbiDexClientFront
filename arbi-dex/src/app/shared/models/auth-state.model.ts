import { WalletProvider, WalletInfo } from './wallet.model';

export type AuthStatus = 'idle' | 'connecting' | 'connected' | 'error';

/** Результат полного цикла аутентификации (wallet → nonce → sign → verify) */
export interface AuthResult {
  walletInfo: WalletInfo;
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export interface AuthState {
  walletAddress: string | null;
  walletProvider: WalletProvider | null;
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  status: AuthStatus;
  error: string | null;
}

