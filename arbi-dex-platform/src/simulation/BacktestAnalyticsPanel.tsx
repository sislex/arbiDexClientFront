import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ServerBacktestResult } from '../services/botsApi'

const REASON_LABEL: Record<string, string> = {
  auto_buy: 'auto_buy',
  auto_sell: 'auto_sell',
  sell: 'sell',
  stop_loss: 'стоп-лосс',
  trailing_take_profit: 'take-profit',
  max_holding_time: 'время удержания',
  close_at_end: 'закрытие в конце',
}

function fmtTradeTime(time: number): string {
  const ms = time > 1e12 ? time : time * 1000
  const d = new Date(ms)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${month}, ${hour}:${minute}`
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms} мс`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} с`
  return `${Math.round(s / 60)} мин`
}

function fmtSigned(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtAmount(value: number, maxFraction = 4): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: maxFraction })
}

interface StatCardProps {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  borderColor: string
  textSecondary: string
  panelBg: string
}

function StatCard({ label, value, sub, borderColor, textSecondary, panelBg }: StatCardProps) {
  return (
    <div
      className="flex min-h-[72px] min-w-0 flex-col justify-center rounded-md px-3 py-2.5"
      style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}` }}
    >
      <div
        className="mb-1 truncate uppercase tracking-[0.06em]"
        style={{ fontSize: '10px', color: textSecondary, fontFamily: 'var(--font-mono)' }}
        title={label}
      >
        {label}
      </div>
      <div className="min-w-0 truncate whitespace-nowrap" style={{ fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 min-w-0 truncate whitespace-nowrap">{sub}</div> : null}
    </div>
  )
}

export interface BacktestAnalyticsPanelProps {
  result: ServerBacktestResult
  baseAsset: string
  quoteAsset: string
  isDark?: boolean
  onTradeSelect?: (time: number) => void
}

export function BacktestAnalyticsPanel({
  result,
  baseAsset,
  quoteAsset,
  isDark = true,
  onTradeSelect,
}: BacktestAnalyticsPanelProps) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(true)
  }, [result.id])

  const borderColor = isDark ? '#1E2D40' : '#D1D9E0'
  const textPrimary = isDark ? '#E8EDF2' : '#0F1923'
  const textSecondary = isDark ? '#6B7A8D' : '#5A6A7A'
  const panelBg = isDark ? '#111722' : '#FFFFFF'
  const surfaceBg = isDark ? '#0D1520' : '#F5F7FA'
  const rowHoverBg = isDark ? '#1A2333' : '#F0F2F5'
  const accent = isDark ? '#F5C400' : '#D4A900'
  const success = '#10B981'
  const error = '#E5383B'

  const { stats: s, trades } = result
  const pnlColor = s.pnl >= 0 ? success : error

  const received = (trade: (typeof trades)[number]): string => {
    const value = trade.side === 'buy' ? trade.amount : trade.amount * trade.price
    const asset = trade.side === 'buy' ? baseAsset : quoteAsset
    return `${fmtAmount(value)} ${asset}`
  }

  const valueStyle = { fontSize: '15px', fontWeight: 600 as const, color: textPrimary }

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{ borderTop: `1px solid ${borderColor}`, backgroundColor: surfaceBg }}
      data-testid="backtest-analytics-panel"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:opacity-90"
        style={{ borderBottom: open ? `1px solid ${borderColor}` : undefined }}
        aria-expanded={open}
        data-testid="backtest-analytics-toggle"
      >
        {open ? (
          <ChevronUp size={14} style={{ color: textSecondary }} />
        ) : (
          <ChevronDown size={14} style={{ color: textSecondary }} />
        )}
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: textSecondary,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}
        >
          Аналитика бэктеста
        </span>
        {!open && (
          <span className="ml-1 flex min-w-0 items-center gap-2 truncate" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: pnlColor }}>{fmtSigned(s.pnl)}</span>
            <span style={{ color: textSecondary }}>· {s.trades} сделок</span>
          </span>
        )}
        <span className="ml-auto shrink-0" style={{ fontSize: '10px', color: textSecondary }}>
          {open ? 'Свернуть' : 'Развернуть'}
        </span>
      </button>

      {open && (
        <div className="px-4 py-3">
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="PnL"
              borderColor={borderColor}
              textSecondary={textSecondary}
              panelBg={panelBg}
              value={<span style={{ ...valueStyle, color: pnlColor }}>{fmtSigned(s.pnl)}</span>}
              sub={
                <span style={{ fontSize: '11px', color: pnlColor, fontFamily: 'var(--font-mono)' }}>
                  ({s.pnlPct >= 0 ? '+' : ''}{s.pnlPct.toFixed(2)}%)
                </span>
              }
            />
            <StatCard
              label="Итоговый баланс"
              borderColor={borderColor}
              textSecondary={textSecondary}
              panelBg={panelBg}
              value={
                <span style={valueStyle}>
                  {fmtAmount(s.finalBalance)}{' '}
                  <span style={{ fontSize: '11px', fontWeight: 500, color: textSecondary }}>{quoteAsset}</span>
                </span>
              }
            />
            <StatCard
              label="Сделок"
              borderColor={borderColor}
              textSecondary={textSecondary}
              panelBg={panelBg}
              value={<span style={valueStyle}>{s.trades}</span>}
            />
            <StatCard
              label="Winrate"
              borderColor={borderColor}
              textSecondary={textSecondary}
              panelBg={panelBg}
              value={<span style={valueStyle}>{s.winRate}%</span>}
            />
            <StatCard
              label="Макс. просадка"
              borderColor={borderColor}
              textSecondary={textSecondary}
              panelBg={panelBg}
              value={<span style={valueStyle}>{s.maxDrawdownPct}%</span>}
            />
            <StatCard
              label="Время расчёта"
              borderColor={borderColor}
              textSecondary={textSecondary}
              panelBg={panelBg}
              value={<span style={valueStyle}>{fmtDuration(result.tookMs)}</span>}
            />
          </div>

          <div
            className="overflow-hidden rounded-md"
            style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}` }}
          >
            <div className="px-3 py-2" style={{ borderBottom: `1px solid ${borderColor}` }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: textPrimary }}>
                Сделки ({trades.length})
              </span>
            </div>
            <div className="max-h-52 overflow-auto" data-testid="backtest-trades-table">
              <table className="w-full min-w-[640px] text-left" style={{ fontSize: '11px' }}>
                <thead className="sticky top-0 z-10" style={{ backgroundColor: panelBg }}>
                  <tr style={{ borderBottom: `1px solid ${borderColor}`, color: textSecondary }}>
                    {['Время', 'Сторона', 'Цена', 'Получено', 'PnL', 'Причина'].map((col, i) => (
                      <th
                        key={col}
                        className={`px-3 py-2 font-medium uppercase tracking-wide ${i >= 2 && i <= 4 ? 'text-right' : ''}`}
                        style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => {
                    const isBuy = trade.side === 'buy'
                    const sideColor = isBuy ? success : error
                    return (
                      <tr
                        key={trade.id}
                        style={{ borderBottom: `1px solid ${borderColor}`, cursor: onTradeSelect ? 'pointer' : undefined }}
                        onClick={() => onTradeSelect?.(trade.time)}
                        data-testid={`backtest-trade-row-${trade.id}`}
                        onMouseEnter={(e) => {
                          if (onTradeSelect) {
                            (e.currentTarget as HTMLTableRowElement).style.backgroundColor = rowHoverBg
                          }
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'
                        }}
                      >
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: textPrimary, fontFamily: 'var(--font-mono)' }}>
                          {fmtTradeTime(trade.time)}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{
                              color: sideColor,
                              border: `1px solid ${sideColor}55`,
                              backgroundColor: `${sideColor}12`,
                            }}
                          >
                            {isBuy ? 'Покупка' : 'Продажа'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={{ color: textPrimary, fontFamily: 'var(--font-mono)' }}>
                          {trade.price}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={{ color: textPrimary, fontFamily: 'var(--font-mono)' }}>
                          {received(trade)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap" style={{ fontFamily: 'var(--font-mono)' }}>
                          {trade.pnl != null ? (
                            <span style={{ color: trade.pnl >= 0 ? success : error }}>{fmtSigned(trade.pnl)}</span>
                          ) : (
                            <span style={{ color: textSecondary }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: textSecondary }}>
                          {trade.reason ? REASON_LABEL[trade.reason] ?? trade.reason : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {trades.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-5 text-center" style={{ color: textSecondary }}>
                        Сделок нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {result.stepsTruncated && (
            <p className="mt-2" style={{ fontSize: '10px', color: accent, fontFamily: 'var(--font-mono)' }}>
              Расчёт выполнен на последних {result.evaluatedSteps ?? 1000} точках периода.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
