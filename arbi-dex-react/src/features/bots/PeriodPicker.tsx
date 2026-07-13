import { Stack, ButtonGroup, Button, TextField } from '@mui/material';
import type { PeriodState } from './usePeriod';

/** Preset + custom date-range controls for a bot backtest/autotune period. */
export function PeriodPicker({ period, idPrefix }: { period: PeriodState; idPrefix: string }) {
  const { from, to, setFrom, setTo, setPreset, dateStr, parseDate, WEEK, MONTH } = period;
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
      <ButtonGroup size="small" variant="outlined" data-testid={`${idPrefix}-presets`}>
        <Button onClick={() => setPreset(WEEK)}>Неделя</Button>
        <Button onClick={() => setPreset(MONTH)}>Месяц</Button>
        <Button onClick={() => setPreset('all')}>Вся история</Button>
      </ButtonGroup>
      <TextField
        label="Начало" size="small" type="date" value={dateStr(from)}
        onChange={(e) => setFrom(parseDate(e.target.value, false))}
        InputLabelProps={{ shrink: true }} sx={{ width: 170 }}
        inputProps={{ 'data-testid': `${idPrefix}-from` }}
      />
      <TextField
        label="Конец" size="small" type="date" value={dateStr(to)}
        onChange={(e) => setTo(parseDate(e.target.value, true))}
        InputLabelProps={{ shrink: true }} sx={{ width: 170 }}
        inputProps={{ 'data-testid': `${idPrefix}-to` }}
      />
    </Stack>
  );
}
