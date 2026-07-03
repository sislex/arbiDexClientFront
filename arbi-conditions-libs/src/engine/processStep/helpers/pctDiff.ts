/** Percentage difference of `current` relative to `base`. Returns 0 when base is 0. */
export function pctDiff(current: number, base: number): number {
  if (base === 0) return 0;
  return ((current - base) / base) * 100;
}
