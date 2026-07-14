import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { WalletConnectButton } from '../components/auth/WalletConnectButton'
import { WalletSelectorDialog } from '../components/auth/WalletSelectorDialog'

const FEATURES = [
  'Live quotes from Arbitrum, Binance, Bybit, MEXC',
  'Custom source & pair subscriptions',
  'Spread monitoring & analytics',
]

export function LoginPage() {
  const { isAuthenticated, isConnecting, error, connect } = useAuth()
  const [walletDialogOpen, setWalletDialogOpen] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <div className="login-page flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="login-card flex w-full max-w-[480px] flex-col gap-6 rounded-[var(--radius-lg)] border border-border bg-card p-8 shadow-2xl">
          <div className="login-card__logo flex items-center gap-2 text-2xl font-bold text-foreground">
            <span className="text-accent-gold">◈</span>
            <span>ArbiDex</span>
          </div>

          <div className="login-card__desc">
            <h2 className="mb-2 text-xl font-semibold text-foreground">Monitor DeFi & CeFi Quotes</h2>
            <p className="m-0 leading-relaxed text-muted">
              Real-time arbitrage monitoring across DEX and CEX exchanges.
              Connect your wallet to get started.
            </p>
          </div>

          <ul className="login-card__features m-0 flex list-none flex-col gap-2 p-0">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted">
                <span className="feature-dot h-1.5 w-1.5 shrink-0 rounded-full bg-accent-gold" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="login-card__actions flex flex-col gap-2">
            <WalletConnectButton
              status={isConnecting ? 'connecting' : 'idle'}
              label={isConnecting ? 'Connecting…' : 'Connect Wallet'}
              onClick={() => setWalletDialogOpen(true)}
            />
          </div>

          {error && <p className="login-card__error m-0 text-sm text-error">{error}</p>}
        </div>
      </div>

      <WalletSelectorDialog
        open={walletDialogOpen}
        onClose={() => setWalletDialogOpen(false)}
        onSelect={(provider) => void connect(provider)}
      />
    </>
  )
}
