import type { StepCondition } from '../../data/botDemoData'
import { cn } from '../../lib/utils'

function ConditionList({ title, conditions }: { title: string; conditions: StepCondition[] }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-2">
        {conditions.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="text-white/90">
                <span className="text-warning font-semibold">Правило {c.ruleNumber}</span>
                {' — '}
                {c.label}
              </p>
              {c.detail && <p className="text-muted mt-0.5">{c.detail}</p>}
            </div>
            <span
              className={cn(
                'shrink-0 font-semibold uppercase',
                c.passed ? 'text-success' : 'text-error',
              )}
            >
              {c.passed ? 'true' : 'false'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StepAnalysisPanel({
  buyConditions,
  sellConditions,
}: {
  buyConditions: StepCondition[]
  sellConditions: StepCondition[]
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Анализ текущего шага</h3>
      <ConditionList title="Условия покупки" conditions={buyConditions} />
      <div className="border-t border-border/60 pt-4">
        <ConditionList title="Условия продажи" conditions={sellConditions} />
      </div>
    </div>
  )
}
