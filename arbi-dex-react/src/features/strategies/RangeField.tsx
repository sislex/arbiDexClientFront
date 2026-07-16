import { Box, Chip, Stack, Switch, TextField, Typography, FormControlLabel } from '@mui/material';
import type { TuneRange } from '../../domain/types';

/** How many values the range produces: min..max inclusive with the given step
 * (1..3 step 0.5 → 1, 1.5, 2, 2.5, 3 → 5). The autotune run count is
 * multiplied by this. Null when the range is invalid. */
export function tuneRangeValueCount(r: TuneRange): number | null {
  if (!(r.step > 0) || r.max < r.min) return null;
  return Math.floor((r.max - r.min) / r.step + 1e-9) + 1;
}

/** Auto-tune range editor for one coefficient (feature 8): min/max/step + on/off. */
export function RangeField({
  label,
  value,
  onChange,
  testidPrefix,
}: {
  label: string;
  value: TuneRange;
  onChange: (v: TuneRange) => void;
  testidPrefix?: string;
}) {
  const set = (patch: Partial<TuneRange>) => onChange({ ...value, ...patch });
  const count = tuneRangeValueCount(value);
  const numField = (key: 'min' | 'max' | 'step') => (
    <TextField
      label={key}
      type="number"
      size="small"
      value={value[key]}
      disabled={!value.enabled}
      onChange={(e) => set({ [key]: parseFloat(e.target.value) || 0 } as Partial<TuneRange>)}
      inputProps={{ 'data-testid': testidPrefix ? `${testidPrefix}-${key}` : undefined }}
      sx={{ width: 90 }}
    />
  );
  return (
    <Box sx={{ pl: 2, borderLeft: '2px solid rgba(255,255,255,0.08)', mt: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={value.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
              inputProps={{ 'data-testid': testidPrefix ? `${testidPrefix}-enabled` : undefined } as never}
            />
          }
          label={<Typography variant="caption">Подбор: {label}</Typography>}
        />
        {value.enabled && (
          <Chip
            size="small"
            variant="outlined"
            color={count != null ? 'info' : 'error'}
            label={count != null ? `×${count} прогонов` : 'некорректный диапазон'}
            data-testid={testidPrefix ? `${testidPrefix}-count` : undefined}
          />
        )}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        {numField('min')}
        {numField('max')}
        {numField('step')}
      </Stack>
    </Box>
  );
}
