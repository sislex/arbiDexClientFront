import { fmtSigned, fmtTradeTime } from '../../lib/botFormatters'
import type { ServerBotTrade } from '../../services/botsApi'

interface BotSessionTradesTableProps {
  trades: ServerBotTrade[]
  baseAsset: string
  quoteAsset: string
  onRowClick?: (trade: ServerBotTrade) => void
}

export function BotSessionTradesTable({
  trades,
  baseAsset,
  quoteAsset,
  onRowClick,
}: BotSessionTradesTableProps) {
  const received = (trade: ServerBotTrade): string => {
    const value = trade.side === 'buy' ? trade.amountIn : trade.amountIn * (trade.price ?? trade.expectedPrice ?? 0)
    const asset = trade.side === 'buy' ? baseAsset : quoteAsset
    return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${asset}`
  }

  return (
    <div className="overflow-x-auto" data-testid="session-trades-table">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2 font-medium">Время</th>
            <th className="px-4 py-2 font-medium">Сторона</th>
            <th className="px-4 py-2 font-medium">Статус</th>
            <th className="px-4 py-2 font-medium text-right">Цена</th>
            <th className="px-4 py-2 font-medium text-right">Объём</th>
            <th className="px-4 py-2 font-medium text-right">PnL</th>
            <th className="px-4 py-2 font-medium">Ошибка</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const isBuy = trade.side === 'buy'
            const sideColor = isBuy ? 'text-success border-success/40 bg-success/10' : 'text-error border-error/40 bg-error/10'
            return (
              <tr
                key={trade.id}
                className={`border-b border-border ${onRowClick ? 'cursor-pointer hover:bg-card-hover' : ''}`}
                onClick={() => onRowClick?.(trade)}
                data-testid={`session-trade-row-${trade.id}`}
              >
                <td className="px-4 py-2 font-mono text-foreground whitespace-nowrap">{fmtTradeTime(trade.time)}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-semibold ${sideColor}`}>
                    {isBuy ? 'Покупка' : 'Продажа'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={trade.status === 'success' ? 'text-success' : 'text-error'}>
                    {trade.status === 'success' ? 'успех' : 'отклонена'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono text-foreground whitespace-nowrap">
                  {trade.price ?? trade.expectedPrice ?? '—'}
                </td>
                <td className="px-4 py-2 text-right font-mono text-foreground whitespace-nowrap">{received(trade)}</td>
                <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                  {trade.pnl != null ? (
                    <span className={trade.pnl >= 0 ? 'text-success' : 'text-error'}>{fmtSigned(trade.pnl)}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-muted max-w-[220px] truncate" title={trade.error ?? undefined}>
                  {trade.error ?? (trade.mode === 'demo' ? 'демо' : '—')}
                </td>
              </tr>
            )
          })}
          {trades.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-muted">
                Сделок в этой сессии нет
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
