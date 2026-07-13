import type { ReactNode } from 'react';
import { Box, Typography, Stack } from '@mui/material';

/** Standard page title row with optional subtitle and right-aligned actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 3 }}>
      <Box>
        <Typography variant="h5">{title}</Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
    </Stack>
  );
}
