import { Typography } from '@mui/material';
import type { TypographyProps } from '@mui/material';
import { fmtPct, fmtSigned } from './format';

/** Colored PnL value: green when ≥0, red when negative. */
export function PnlValue({
  value,
  pct,
  variant = 'body2',
}: {
  value: number;
  pct?: number;
  variant?: TypographyProps['variant'];
}) {
  const color = value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.secondary';
  return (
    <Typography component="span" variant={variant} sx={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      {fmtSigned(value)}
      {pct !== undefined && ` (${fmtPct(pct)})`}
    </Typography>
  );
}
