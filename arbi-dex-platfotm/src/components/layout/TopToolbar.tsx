import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAppPreferences } from '../../context/AppPreferencesContext'
import { useAuth } from '../../context/AuthContext'
import { WalletAccountChip } from '../auth/WalletAccountChip'
import { UserMenu } from './UserMenu'
import { cn } from '../../lib/utils'
import { shortAddress } from '../../lib/shortAddress'

export function TopToolbar() {
  const { userName } = useAppPreferences()
  const { walletAddress, walletProvider } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const displayName = walletAddress ? shortAddress(walletAddress) : userName

  return (
    <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="flex h-full items-center justify-end gap-3 px-6">
        {walletAddress && (
          <WalletAccountChip address={walletAddress} provider={walletProvider ?? undefined} />
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 transition-colors hover:bg-card-hover',
              menuOpen && 'border-accent-gold/40 bg-menu-active',
            )}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan text-xs font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden max-w-[140px] truncate text-sm font-medium text-foreground sm:inline">
              {displayName}
            </span>
            <ChevronDown
              size={16}
              className={cn('text-muted transition-transform', menuOpen && 'rotate-180')}
            />
          </button>

          <UserMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
        </div>
      </div>
    </header>
  )
}
