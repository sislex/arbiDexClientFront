/**
 * Shortens an Ethereum wallet address.
 * Example: 0x742d…4B3e
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/**
 * Formats a spread value as a percentage string.
 * Example: 0.00125 → "0.13%"
 */
export function formatSpreadPct(spreadPct: number): string {
  return `${(spreadPct * 100).toFixed(3)}%`;
}

/**
 * Formats a price number with appropriate decimals.
 */
export function formatPrice(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats a timestamp to a locale time string.
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

