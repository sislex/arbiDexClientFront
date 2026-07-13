import { Box, Stack, Switch, TextField, Typography, FormControlLabel } from '@mui/material';
import type { TuneRange } from '../../domain/types';

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
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        {numField('min')}
        {numField('max')}
        {numField('step')}
      </Stack>
    </Box>
  );
}
