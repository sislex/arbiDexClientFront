import type { ReactNode } from 'react';
import { Card, CardContent, Typography, Stack } from '@mui/material';

/** Compact KPI tile: label + big value + optional sub content. */
export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <Card sx={{ flex: 1, minWidth: 160 }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {label}
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.5 }}>
          <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Typography>
        </Stack>
        {sub && <div>{sub}</div>}
      </CardContent>
    </Card>
  );
}
