import { Loader2, Wallet } from 'lucide-react'
import { cn } from '../../lib/utils'

export type WalletConnectStatus = 'idle' | 'connecting' | 'connected'

interface WalletConnectButtonProps {
  status?: WalletConnectStatus
  label?: string
  onClick?: () => void
  className?: string
}

export function WalletConnectButton({
  status = 'idle',
  label = 'Connect Wallet',
  onClick,
  className,
}: WalletConnectButtonProps) {
  return (
    <button
      type="button"
      disabled={status === 'connecting'}
      onClick={onClick}
      className={cn(
        'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold transition-colors',
        status === 'connected'
          ? 'bg-success text-white'
          : 'bg-accent-gold text-[#0b1120] hover:bg-accent-gold/90',
        status === 'connecting' && 'opacity-80',
        className,
      )}
    >
      {status === 'connecting' ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <Wallet size={18} />
      )}
      <span>{label}</span>
    </button>
  )
}
