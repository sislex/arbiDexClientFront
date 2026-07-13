/** Shared formatting helpers. */

export function fmtMoney(n: number, currency = 'USDC'): string {
  const v = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v} ${currency}`;
}

export function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtSigned(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.round(s / 60);
  return `${m} мин`;
}
