import { Wallet } from 'lucide-react'
import { shortAddress } from '../../lib/shortAddress'

interface WalletAccountChipProps {
  address: string
  provider?: string
}

export function WalletAccountChip({ address, provider }: WalletAccountChipProps) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2"
      title={address}
    >
      <Wallet size={16} className="text-success shrink-0" />
      <span className="font-mono text-sm font-medium text-foreground">{shortAddress(address)}</span>
      {provider && (
        <span className="border-l border-border pl-2 text-xs text-muted">{provider}</span>
      )}
    </div>
  )
}
