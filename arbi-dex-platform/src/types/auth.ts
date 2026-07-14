export const WalletProvider = {
  MetaMask: 'MetaMask',
  WalletConnect: 'WalletConnect',
  CoinbaseWallet: 'CoinbaseWallet',
} as const

export type WalletProvider = (typeof WalletProvider)[keyof typeof WalletProvider]

export interface WalletInfo {
  address: string
  provider: WalletProvider
}

export type AuthStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface AuthResult {
  walletInfo: WalletInfo
  accessToken: string
  refreshToken: string
  userId: string
}

export interface AuthState {
  walletAddress: string | null
  walletProvider: WalletProvider | null
  userId: string | null
  accessToken: string | null
  refreshToken: string | null
  isConnected: boolean
  isAuthenticated: boolean
  status: AuthStatus
  error: string | null
}

export interface VerifyResponse {
  accessToken: string
  refreshToken: string
  user: { id: string; walletAddress: string; walletProvider: string }
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

export interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  isMetaMask?: boolean
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}
