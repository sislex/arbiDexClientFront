export function fmtSessionTime(unixMs: number): string {
  return new Date(unixMs).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtTradeTime(unixMs: number): string {
  return new Date(unixMs).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function fmtDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} с`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} мин`
  const h = Math.floor(ms / 3_600_000)
  const m = Math.round((ms % 3_600_000) / 60_000)
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}

export function fmtSigned(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function sessionModeLabel(mode: string): string {
  if (mode === 'real-live') return 'Реальный'
  if (mode === 'demo-live') return 'Демо'
  return mode || '—'
}
