import { filterStepsByExcludedRanges, isTimeExcluded, normalizeExcludedRanges, parseExcludedRanges } from './excluded-ranges';

describe('excluded-ranges', () => {
  it('normalizes and merges overlapping ranges', () => {
    expect(
      normalizeExcludedRanges([
        { start: 30, end: 40 },
        { start: 10, end: 20 },
        { start: 18, end: 25 },
      ]),
    ).toEqual([
      { start: 10, end: 25 },
      { start: 30, end: 40 },
    ]);
  });

  it('parses json payload and swaps invalid bounds', () => {
    expect(
      parseExcludedRanges(JSON.stringify([{ start: 50, end: 10 }, { start: 70, end: 90 }])),
    ).toEqual([
      { start: 10, end: 50 },
      { start: 70, end: 90 },
    ]);
  });

  it('finds excluded point and filters steps', () => {
    const ranges = normalizeExcludedRanges([{ start: 20, end: 30 }]);
    expect(isTimeExcluded(25, ranges)).toEqual({ start: 20, end: 30 });
    expect(isTimeExcluded(31, ranges)).toBeNull();

    const steps = [
      { time: 10, quotes: { buyQuote: 1, sellQuote: 1, avgObservedQuote: 1 } },
      { time: 25, quotes: { buyQuote: 1, sellQuote: 1, avgObservedQuote: 1 } },
      { time: 35, quotes: { buyQuote: 1, sellQuote: 1, avgObservedQuote: 1 } },
    ];
    const filtered = filterStepsByExcludedRanges(steps, ranges);
    expect(filtered.map((s) => s.time)).toEqual([10, 35]);
  });
});
