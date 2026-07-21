/** Maps engine condition `actual`/`required` values to UI strings. */
export function formatEngineConditionActual(
  id: string,
  actual: number | string | undefined | null,
): string | undefined {
  if (actual === undefined || actual === null) {
    if (id === 'transaction_delay_ok') return '∞'
    return undefined
  }

  if (typeof actual === 'string') {
    if (id === 'no_transaction_in_progress') {
      return actual === 'in_progress' ? 'Идёт' : 'Нет'
    }
    return actual
  }

  if (!Number.isFinite(actual)) {
    if (id === 'transaction_delay_ok') return '∞'
    return '∞'
  }

  if (id === 'transaction_delay_ok') return String(Math.round(actual))
  return String(actual)
}

export function formatEngineConditionRequired(
  id: string,
  required: number | string | undefined | null,
): string | undefined {
  if (required === undefined || required === null) return undefined
  if (id === 'no_transaction_in_progress' && required === 'none') return 'Нет'
  if (typeof required === 'number' && id === 'transaction_delay_ok') return String(Math.round(required))
  return String(required)
}
