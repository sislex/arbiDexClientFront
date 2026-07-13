import { Autocomplete, TextField, Chip } from '@mui/material';
import type { Market } from '../../domain/types';
import { marketLabel } from './marketLabel';

/** Select a single market from the catalog, optionally filtered by kind. */
export function MarketPicker({
  markets,
  value,
  onChange,
  label,
  kind,
  exclude = [],
  testid,
}: {
  markets: Market[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  kind?: 'cex' | 'dex';
  exclude?: string[];
  testid?: string;
}) {
  const options = markets.filter((m) => (kind ? m.kind === kind : true) && !exclude.includes(m.id));
  const selected = markets.find((m) => m.id === value) ?? null;
  return (
    <Autocomplete
      options={options}
      value={selected}
      getOptionLabel={marketLabel}
      onChange={(_, v) => onChange(v?.id ?? null)}
      renderInput={(params) => <TextField {...params} label={label} size="small" inputProps={{ ...params.inputProps, 'data-testid': testid }} />}
      renderOption={(props, m) => (
        <li {...props} key={m.id}>
          <Chip size="small" label={m.kind.toUpperCase()} sx={{ mr: 1 }} variant="outlined" />
          {marketLabel(m)}
        </li>
      )}
      sx={{ minWidth: 280 }}
    />
  );
}
