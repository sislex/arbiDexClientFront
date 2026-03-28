import { shortenAddress, formatSpreadPct, formatPrice, formatTimestamp } from './format.utils';

describe('shortenAddress', () => {
  it('should shorten a full address', () => {
    expect(shortenAddress('0x742d35Cc6634C0532925a3b8D4C9B8f3e4F4B3e'))
      .toBe('0x742d…4B3e');
  });

  it('should return empty string for falsy input', () => {
    expect(shortenAddress('')).toBe('');
  });

  it('should respect custom chars count', () => {
    // '0xABCDEF1234567890' → slice(0, 8)='0xABCDEF', slice(-6)='567890'
    const result = shortenAddress('0xABCDEF1234567890', 6);
    expect(result).toBe('0xABCDEF…567890');
  });
});

describe('formatSpreadPct', () => {
  it('should format spread pct correctly', () => {
    expect(formatSpreadPct(0.00125)).toBe('0.125%');
  });

  it('should handle zero', () => {
    expect(formatSpreadPct(0)).toBe('0.000%');
  });
});

describe('formatPrice', () => {
  it('should format price with default 2 decimals', () => {
    expect(formatPrice(1234.5678)).toBe('1,234.57');
  });

  it('should format with custom decimals', () => {
    expect(formatPrice(1234.5678, 4)).toBe('1,234.5678');
  });
});

describe('formatTimestamp', () => {
  it('should return a non-empty time string', () => {
    const result = formatTimestamp(Date.now());
    expect(result).toBeTruthy();
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});


