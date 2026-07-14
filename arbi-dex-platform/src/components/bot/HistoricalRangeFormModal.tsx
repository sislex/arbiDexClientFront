import { useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { Modal, ModalFooter } from '../ui/Modal'
import { Select } from '../ui/SearchInput'
import { DateDropdownGroup, datePartsToInput } from './DateDropdownGroup'
import {
  HISTORICAL_RANGE_OPTIONS,
  isCustomRangeValid,
  resolveHistoricalRange,
  toDateParts,
  type HistoricalRangePreset,
} from '../../lib/historicalRange'
import { cn } from '../../lib/utils'

export interface HistoricalRangeFormValues {
  preset: HistoricalRangePreset
  from: string
  to: string
  strategyId: string
}

interface HistoricalRangeFormModalProps {
  open: boolean
  onClose: () => void
  onApply: (values: HistoricalRangeFormValues) => void
  initialPreset?: HistoricalRangePreset
  initialFrom?: string
  initialTo?: string
  initialStrategyId: string
  strategyOptions: { value: string; label: string }[]
  botName?: string
}

export function HistoricalRangeFormModal({
  open,
  onClose,
  onApply,
  initialPreset = '30d',
  initialFrom,
  initialTo,
  initialStrategyId,
  strategyOptions,
  botName,
}: HistoricalRangeFormModalProps) {
  const resolved = resolveHistoricalRange(initialPreset, initialFrom, initialTo)
  const [preset, setPreset] = useState<HistoricalRangePreset>(initialPreset)
  const [fromParts, setFromParts] = useState(() => toDateParts(resolved.from))
  const [toParts, setToParts] = useState(() => toDateParts(resolved.to))
  const [strategyId, setStrategyId] = useState(initialStrategyId)

  useEffect(() => {
    if (!open) return
    const next = resolveHistoricalRange(initialPreset, initialFrom, initialTo)
    setPreset(initialPreset)
    setFromParts(toDateParts(next.from))
    setToParts(toDateParts(next.to))
    setStrategyId(initialStrategyId)
  }, [open, initialPreset, initialFrom, initialTo, initialStrategyId])

  const handlePresetChange = (nextPreset: HistoricalRangePreset) => {
    setPreset(nextPreset)
    if (nextPreset !== 'custom') {
      const range = resolveHistoricalRange(nextPreset)
      setFromParts(toDateParts(range.from))
      setToParts(toDateParts(range.to))
    }
  }

  const customValid = preset !== 'custom' || isCustomRangeValid(fromParts, toParts)

  const handleApply = () => {
    if (!customValid) return
    if (preset === 'custom') {
      const dates = datePartsToInput(fromParts, toParts)
      onApply({ preset, from: dates.from, to: dates.to, strategyId })
      return
    }
    const range = resolveHistoricalRange(preset)
    onApply({
      preset,
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
      strategyId,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Период исторических данных"
      size="lg"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleApply}
          cancelLabel="Отмена"
          confirmLabel="Показать график"
          confirmDisabled={!customValid}
        />
      }
    >
      <div className="space-y-5">
        {botName && (
          <p className="text-sm text-muted">
            Выберите период и стратегию для просмотра истории бота{' '}
            <span className="text-foreground font-medium">{botName}</span>
          </p>
        )}

        <div>
          <label className="text-sm text-muted block mb-1.5">Период</label>
          <Select
            value={preset}
            onChange={(v) => handlePresetChange(v as HistoricalRangePreset)}
            options={HISTORICAL_RANGE_OPTIONS}
            className="w-full"
          />
        </div>

        {preset === 'custom' && (
          <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <CalendarRange size={16} />
              <span>Свой период — выберите даты из списков</span>
            </div>
            <DateDropdownGroup label="С" value={fromParts} onChange={setFromParts} />
            <DateDropdownGroup label="По" value={toParts} onChange={setToParts} />
            {!customValid && (
              <p className="text-xs text-warning">
                Дата «С» должна быть не позже «По», а «По» — не позже сегодня
              </p>
            )}
          </div>
        )}

        {preset !== 'custom' && (
          <p className={cn('text-xs text-muted px-1')}>
            Будут загружены данные за выбранный стандартный период от текущей даты
          </p>
        )}

        <div>
          <label className="text-sm text-muted block mb-1.5">Стратегия</label>
          <Select
            value={strategyId}
            onChange={setStrategyId}
            options={strategyOptions}
            className="w-full"
          />
        </div>
      </div>
    </Modal>
  )
}
