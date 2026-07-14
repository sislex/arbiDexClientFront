import { ChevronRight, QrCode, Wallet, Bitcoin } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { WalletProvider, type WalletProvider as WalletProviderType } from '../../types/auth'
import { cn } from '../../lib/utils'

export interface WalletOption {
  provider: WalletProviderType
  name: string
  description: string
  icon: 'wallet' | 'qr' | 'bitcoin'
}

const WALLET_OPTIONS: WalletOption[] = [
  {
    provider: WalletProvider.MetaMask,
    name: 'MetaMask',
    description: 'Browser extension wallet',
    icon: 'wallet',
  },
  {
    provider: WalletProvider.WalletConnect,
    name: 'WalletConnect',
    description: 'Scan with mobile wallet',
    icon: 'qr',
  },
  {
    provider: WalletProvider.CoinbaseWallet,
    name: 'Coinbase Wallet',
    description: 'Coinbase self-custody wallet',
    icon: 'bitcoin',
  },
]

function WalletOptionIcon({ icon }: { icon: WalletOption['icon'] }) {
  if (icon === 'qr') return <QrCode size={22} className="text-accent-gold shrink-0" />
  if (icon === 'bitcoin') return <Bitcoin size={22} className="text-accent-gold shrink-0" />
  return <Wallet size={22} className="text-accent-gold shrink-0" />
}

interface WalletSelectorDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (provider: WalletProviderType) => void
}

export function WalletSelectorDialog({ open, onClose, onSelect }: WalletSelectorDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect Wallet"
      size="md"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted">Select your preferred wallet provider</p>
      <div className="flex flex-col gap-2">
        {WALLET_OPTIONS.map((opt) => (
          <button
            key={opt.provider}
            type="button"
            onClick={() => {
              onSelect(opt.provider)
              onClose()
            }}
            className={cn(
              'flex w-full items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors',
              'hover:border-accent-gold/50 hover:bg-accent-gold/5',
            )}
          >
            <WalletOptionIcon icon={opt.icon} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{opt.name}</p>
              <p className="text-xs text-muted">{opt.description}</p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-muted" />
          </button>
        ))}
      </div>
    </Modal>
  )
}
