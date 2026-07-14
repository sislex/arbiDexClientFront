import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthResult, AuthState, WalletProvider as WalletProviderType } from '../types/auth'
import { clearAuthResult, loadAuthResult, saveAuthResult } from '../lib/authStorage'
import { connectWallet, getNonce, signMessage, verifySignature } from '../services/authHttp'

interface AuthContextValue extends AuthState {
  isInitializing: boolean
  isConnecting: boolean
  connect: (provider: WalletProviderType) => Promise<void>
  logout: () => void
}

const initialAuthState: AuthState = {
  walletAddress: null,
  walletProvider: null,
  userId: null,
  accessToken: null,
  refreshToken: null,
  isConnected: false,
  isAuthenticated: false,
  status: 'idle',
  error: null,
}

const AuthContext = createContext<AuthContextValue | null>(null)

function authResultToState(authResult: AuthResult): AuthState {
  return {
    walletAddress: authResult.walletInfo.address,
    walletProvider: authResult.walletInfo.provider,
    userId: authResult.userId,
    accessToken: authResult.accessToken,
    refreshToken: authResult.refreshToken,
    isConnected: true,
    isAuthenticated: true,
    status: 'connected',
    error: null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [state, setState] = useState<AuthState>(initialAuthState)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const stored = loadAuthResult()
    if (stored) {
      setState(authResultToState(stored))
    }
    setIsInitializing(false)
  }, [])

  const connect = useCallback(
    async (provider: WalletProviderType) => {
      setState((prev) => ({ ...prev, status: 'connecting', error: null }))
      try {
        const walletInfo = await connectWallet(provider)
        const { nonce } = await getNonce(walletInfo.address)
        const message = `Войти в ArbiDex\nNonce: ${nonce}`
        const signature = await signMessage(message, walletInfo.address)
        const response = await verifySignature(walletInfo.address, signature, provider)
        const authResult: AuthResult = {
          walletInfo,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          userId: response.user.id,
        }
        saveAuthResult(authResult)
        setState(authResultToState(authResult))
        navigate('/')
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        }))
      }
    },
    [navigate],
  )

  const logout = useCallback(() => {
    clearAuthResult()
    setState(initialAuthState)
    navigate('/login')
  }, [navigate])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isInitializing,
      isConnecting: state.status === 'connecting',
      connect,
      logout,
    }),
    [state, isInitializing, connect, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
