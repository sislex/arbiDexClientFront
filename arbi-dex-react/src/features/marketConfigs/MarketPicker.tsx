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
  showStoreKey = false,
}: {
  markets: Market[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  kind?: 'cex' | 'dex';
  exclude?: string[];
  testid?: string;
  /** Show the raw arbiDexMarketData key (`source|base/quote`) instead of the display label. */
  showStoreKey?: boolean;
}) {
  const options = markets.filter((m) => (kind ? m.kind === kind : true) && !exclude.includes(m.id));
  const selected = markets.find((m) => m.id === value) ?? null;
  const optionLabel = (m: Market) => (showStoreKey && m.storeKey) || marketLabel(m);
  return (
    <Autocomplete
      options={options}
      value={selected}
      getOptionLabel={optionLabel}
      onChange={(_, v) => onChange(v?.id ?? null)}
      renderInput={(params) => <TextField {...params} label={label} size="small" inputProps={{ ...params.inputProps, 'data-testid': testid }} />}
      renderOption={(props, m) => (
        <li {...props} key={m.id} style={{ wordBreak: 'break-all' }}>
          <Chip size="small" label={m.kind.toUpperCase()} sx={{ mr: 1 }} variant="outlined" />
          {optionLabel(m)}
        </li>
      )}
      sx={{ minWidth: 280 }}
    />
  );
}
