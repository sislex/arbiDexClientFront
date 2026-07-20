import { Loader2, Calculator } from 'lucide-react'
import type { EngineConditionEvaluation } from './engineConditionTypes'
import { useSimulatorI18n } from './useSimulatorI18n'
import { getConditionLabel } from './conditionLabels'
import { formatConditionOutcome } from '../lib/conditionsCatalog'
import type { SimulationLogEvent } from './simulationViewerTypes'

interface StepResultPanelProps {
  event: SimulationLogEvent | null
  isDark: boolean
  token1Label: string
  token2Label: string
  loading?: boolean
  error?: string | null
  source?: 'backtest' | 'api' | null
  onRecalc?: () => void
}

function SignalChip({
  label,
  active,
  color,
  isDark,
}: {
  label: string
  active: boolean
  color: string
  isDark: boolean
}) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{
        border: `1px solid ${active ? color : isDark ? '#1E2D40' : '#D1D9E0'}`,
        backgroundColor: active ? `${color}22` : 'transparent',
        color: active ? color : isDark ? '#6B7A8D' : '#5A6A7A',
      }}
    >
      {label}
    </span>
  )
}

function fmtNum(v: number | string | undefined): string {
  if (v === undefined) return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (!Number.isFinite(n)) return '∞'
  const abs = Math.abs(n)
  if (abs >= 1e6) return n.toExponential(2)
  return String(+n.toFixed(abs < 10 ? 4 : 2))
}

export function StepResultPanel({
  event,
  isDark,
  token1Label,
  token2Label,
  loading = false,
  error = null,
  source = null,
  onRecalc,
}: StepResultPanelProps) {
  const { t } = useSimulatorI18n()
  const detail = event?.detail
  const evaluations = detail?.evaluations ?? []

  const groups = (['toBuy', 'toSell'] as const).map((group) => ({
    group,
    items: evaluations.filter((item: EngineConditionEvaluation) => item.group === group),
  }))

  const textSecondary = isDark ? '#8EA0B5' : '#475569'
  const textPrimary = isDark ? '#C4CDD8' : '#374151'

  return (
    <div className="mx-2.5 mt-2 mb-2">
      <div className="mb-2 flex items-center gap-2">
        <span style={{ fontSize: '11px', fontWeight: 600, color: textPrimary }}>Разбор шага</span>
        {loading && <Loader2 size={12} className="animate-spin" style={{ color: textSecondary }} />}
        {source && (
          <span
            className="rounded border px-1.5 py-0.5 text-[10px]"
            style={{ borderColor: isDark ? '#1E2D40' : '#D1D9E0', color: textSecondary }}
            data-testid="step-source"
          >
            {source === 'backtest' ? 'из бэктеста' : 'из API'}
          </span>
        )}
        <span className="flex-1" />
        {onRecalc && (
          <button
            type="button"
            onClick={onRecalc}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-foreground disabled:opacity-50"
            data-testid="step-recalc"
          >
            <Calculator size={11} />
            Рассчитать в API
          </button>
        )}
      </div>

      {error && (
        <div className="mb-2 rounded px-2 py-1.5 text-[11px]" style={{ color: '#E5383B', backgroundColor: '#E5383B14' }}>
          {error}
        </div>
      )}

      {!event && !loading && !error && (
        <p className="py-6 text-center text-[11px]" style={{ color: textSecondary }}>
          Кликните точку на графике или переместите курсор — стратегия будет прогнана движком на этом шаге
        </p>
      )}

      {event && detail && (
        <div data-testid="step-result">
          {detail.stepTime != null && (
            <p className="mb-2 text-[10px]" style={{ color: textSecondary }}>
              {new Date(detail.stepTime).toLocaleString()} · шаг{' '}
              {detail.stepIndex != null ? detail.stepIndex + 1 : '—'}
              {detail.totalSteps != null ? `/${detail.totalSteps}` : ''}
              {detail.windowSteps != null ? ` · окно ${detail.windowSteps} шаг(ов)` : ''}
            </p>
          )}

          <div className="mb-2 flex flex-wrap gap-1">
            <SignalChip label="Покупка" active={Boolean(detail.transactionBuy)} color="#10B981" isDark={isDark} />
            <SignalChip label="Продажа" active={Boolean(detail.transactionSell)} color="#E5383B" isDark={isDark} />
            <SignalChip label="Принуд. продажа" active={Boolean(detail.forcedSell)} color="#F59E0B" isDark={isDark} />
          </div>

          {groups.map(({ group, items }) => {
            if (items.length === 0) return null
            return (
              <div key={group} className="mb-2">
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: '4px',
                  }}
                >
                  {group === 'toBuy' ? 'Условия покупки' : 'Условия продажи'}
                </div>
                <div className="flex flex-col gap-1">
                  {items.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="rounded px-2 py-1"
                      style={{
                        border: `1px solid ${isDark ? '#1E2D40' : '#D1D9E0'}`,
                        backgroundColor: isDark ? '#111722' : '#FFFFFF',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span style={{ fontSize: '11px', color: textPrimary }}>
                          {getConditionLabel(t, item.id, token1Label, token2Label)}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            color: item.passed ? '#10B981' : '#E5383B',
                          }}
                        >
                          {item.passed ? "да" : "нет"}
                        </span>
                      </div>
                      {(item.current !== undefined || item.required !== undefined) && (
                        <div
                          className="mt-0.5"
                          style={{
                            fontSize: '10px',
                            color: isDark ? '#6B7A8D' : '#5A6A7A',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {formatConditionOutcome(item.id, item.current, item.required)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {(detail.buyQuote != null || detail.sellQuote != null || detail.avgQuote != null) && (
            <p className="mt-1 text-[10px]" style={{ color: textSecondary, fontFamily: 'var(--font-mono)' }}>
              bid {fmtNum(detail.sellQuote)} · ask {fmtNum(detail.buyQuote)} · ср. {fmtNum(detail.avgQuote)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
