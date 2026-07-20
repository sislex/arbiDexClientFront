import { getConditionTitle } from '../lib/conditionsCatalog'

type TranslateFn = (key: string) => string

/** Resolve a condition id to a human-readable label for step analysis UI. */
export function getConditionLabel(
  _t: TranslateFn | undefined,
  id: string,
  _token1Label: string,
  _token2Label: string,
): string {
  return getConditionTitle(id)
}
