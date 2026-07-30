import { TRADING_RULE_DEFINITIONS } from '../../data/tradingRulesDefaults'
import type { TradingRuleDefinition, TradingRuleState } from '../../types/tradingRules'
import { cn } from '../../lib/utils'
import { Toggle } from '../ui/Toggle'

interface TradingRulesFormProps {
  rules: TradingRuleState[]
  onChange: (rules: TradingRuleState[]) => void
}

function RuleRow({
  rule,
  onToggle,
  onValueChange,
}: {
  rule: TradingRuleState
  onToggle: (enabled: boolean) => void
  onValueChange: (key: string, value: number) => void
}) {
  const def = TRADING_RULE_DEFINITIONS.find((d) => d.id === rule.id)
  if (!def) return null

  const sideLabel = def.side === 'buy' ? 'Купить' : 'Продать'

  return (
    <div
      className={cn(
        'flex items-start gap-4 py-3.5 border-b border-border/60 last:border-b-0',
        !rule.enabled && 'opacity-45',
      )}
    >
      <div className="w-[148px] shrink-0 pt-0.5">
        <span className="text-xs font-semibold text-warning uppercase tracking-wide">
          Правило #{def.number}
        </span>
        <span className="text-xs font-semibold text-white ml-1">{sideLabel}</span>
      </div>

      <p className="flex-1 text-sm text-white/90 leading-relaxed min-w-0">
        {def.parts.map((part, i) => {
          if (part.type === 'text') {
            return <span key={i}>{part.text}</span>
          }
          const val = rule.values[part.key] ?? def.defaults[part.key] ?? 0
          return (
            <span key={i} className="inline-flex items-baseline gap-0.5 mx-0.5">
              <input
                type="number"
                value={val}
                disabled={!rule.enabled}
                onChange={(e) => onValueChange(part.key, Number(e.target.value))}
                style={{ width: part.width ?? 56 }}
                className="inline-block px-2 py-0.5 bg-surface border border-border rounded-md text-white text-sm text-center focus:outline-none focus:border-warning/50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {part.suffix && <span>{part.suffix}</span>}
            </span>
          )
        })}
      </p>

      <Toggle checked={rule.enabled} onChange={onToggle} className="mt-0.5" />
    </div>
  )
}

function TriggerCard({
  def,
  rule,
  onToggle,
  onValueChange,
}: {
  def: TradingRuleDefinition
  rule: TradingRuleState
  onToggle: (enabled: boolean) => void
  onValueChange: (key: string, value: number) => void
}) {
  const paramPart = def.parts.find((p) => p.type === 'param')
  const paramKey = paramPart && paramPart.type === 'param' ? paramPart.key : null
  const unit = paramPart && paramPart.type === 'param' ? (paramPart.suffix ?? '') : ''
  const value = paramKey != null ? (rule.values[paramKey] ?? def.defaults[paramKey] ?? 0) : 0

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface/60 p-4 transition-opacity',
        !rule.enabled && 'opacity-60',
      )}
      data-testid={`trigger-${rule.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="text-sm font-semibold text-white">{def.title}</h5>
            <span className="rounded-full border border-border bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              trigger
            </span>
          </div>
          {def.description && (
            <p className="mt-1 text-xs leading-relaxed text-muted">{def.description}</p>
          )}
        </div>
        <Toggle checked={rule.enabled} onChange={onToggle} className="mt-0.5" />
      </div>

      {rule.enabled && paramKey && (
        <div className="relative mt-4">
          <label className="absolute -top-2 left-3 z-10 bg-surface px-1 text-[11px] text-muted">
            {def.paramLabel ?? paramKey}
          </label>
          <div className="flex items-center rounded-lg border border-border bg-transparent px-3 py-2.5 focus-within:border-accent-cyan/50">
            <input
              type="number"
              value={value}
              onChange={(e) => onValueChange(paramKey, Number(e.target.value))}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              data-testid={`param-${rule.id}-${paramKey}`}
            />
            {unit && <span className="ml-2 shrink-0 text-sm text-muted">{unit}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function RuleSection({
  title,
  ruleIds,
  rules,
  onChange,
}: {
  title: string
  ruleIds: string[]
  rules: TradingRuleState[]
  onChange: (rules: TradingRuleState[]) => void
}) {
  const sectionRules = ruleIds
    .map((id) => rules.find((r) => r.id === id))
    .filter((r): r is TradingRuleState => Boolean(r))

  const updateRule = (id: string, patch: Partial<TradingRuleState>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div className="rounded-xl border border-border bg-surface/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-white/[0.02]">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h4>
      </div>
      <div className="px-4">
        {sectionRules.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            onToggle={(enabled) => updateRule(rule.id, { enabled })}
            onValueChange={(key, value) =>
              updateRule(rule.id, {
                values: { ...rule.values, [key]: value },
              })
            }
          />
        ))}
      </div>
    </div>
  )
}

function TriggerSection({
  rules,
  onChange,
}: {
  rules: TradingRuleState[]
  onChange: (rules: TradingRuleState[]) => void
}) {
  const defs = TRADING_RULE_DEFINITIONS.filter((d) => d.side === 'sell' && d.kind === 'trigger')

  const updateRule = (id: string, patch: Partial<TradingRuleState>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
          Триггеры принудительной продажи
        </h4>
        <p className="mt-1 text-xs text-muted">
          Срабатывают независимо от обычных условий продажи и закрывают позицию.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-1">
        {defs.map((def) => {
          const rule = rules.find((r) => r.id === def.id)
          if (!rule) return null
          return (
            <TriggerCard
              key={def.id}
              def={def}
              rule={rule}
              onToggle={(enabled) => updateRule(def.id, { enabled })}
              onValueChange={(key, value) =>
                updateRule(def.id, {
                  values: { ...rule.values, [key]: value },
                })
              }
            />
          )
        })}
      </div>
    </div>
  )
}

const BUY_RULE_IDS = TRADING_RULE_DEFINITIONS.filter(
  (d) => d.side === 'buy' && (d.kind ?? 'gate') === 'gate',
).map((d) => d.id)

const SELL_GATE_IDS = TRADING_RULE_DEFINITIONS.filter(
  (d) => d.side === 'sell' && (d.kind ?? 'gate') === 'gate',
).map((d) => d.id)

export function TradingRulesForm({ rules, onChange }: TradingRulesFormProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Правила торговли</h3>
        <p className="text-sm text-muted mt-1">Задайте условия покупки и продажи.</p>
      </div>

      <RuleSection
        title="Условия для покупки"
        ruleIds={BUY_RULE_IDS}
        rules={rules}
        onChange={onChange}
      />

      <RuleSection
        title="Условия для продажи"
        ruleIds={SELL_GATE_IDS}
        rules={rules}
        onChange={onChange}
      />

      <TriggerSection rules={rules} onChange={onChange} />
    </div>
  )
}
