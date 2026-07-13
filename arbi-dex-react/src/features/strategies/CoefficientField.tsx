import { TextField, InputAdornment } from '@mui/material';

/** Numeric coefficient input with an optional unit adornment. */
export function CoefficientField({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
  testid,
}: {
  label: string;
  unit?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  testid?: string;
}) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        onChange(Number.isNaN(n) ? 0 : n);
      }}
      inputProps={{ min, max, step, 'data-testid': testid }}
      InputProps={unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } : undefined}
      sx={{ width: 180 }}
    />
  );
}
