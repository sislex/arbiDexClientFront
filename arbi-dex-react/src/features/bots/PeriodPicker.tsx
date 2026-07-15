import { Stack, ButtonGroup, Button, TextField } from '@mui/material';
import type { PeriodState } from './usePeriod';

/** Preset + custom datetime-range controls for a bot backtest/autotune period.
 * The pickers only allow dates/times within the available history. */
export function PeriodPicker({ period, idPrefix }: { period: PeriodState; idPrefix: string }) {
  const { range, from, to, setFrom, setTo, setPreset, dateStr, parseDate, WEEK, MONTH } = period;
  const min = range ? dateStr(range.historyFrom) : undefined;
  const max = range ? dateStr(range.historyTo) : undefined;
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
      <ButtonGroup size="small" variant="outlined" data-testid={`${idPrefix}-presets`}>
        <Button onClick={() => setPreset(WEEK)}>Неделя</Button>
        <Button onClick={() => setPreset(MONTH)}>Месяц</Button>
        <Button onClick={() => setPreset('all')}>Вся история</Button>
      </ButtonGroup>
      <TextField
        label="Начало" size="small" type="datetime-local" value={dateStr(from)}
        onChange={(e) => setFrom(parseDate(e.target.value))}
        InputLabelProps={{ shrink: true }} sx={{ width: 210 }}
        inputProps={{ min, max: dateStr(to) || max, 'data-testid': `${idPrefix}-from` }}
      />
      <TextField
        label="Конец" size="small" type="datetime-local" value={dateStr(to)}
        onChange={(e) => setTo(parseDate(e.target.value))}
        InputLabelProps={{ shrink: true }} sx={{ width: 210 }}
        inputProps={{ min: dateStr(from) || min, max, 'data-testid': `${idPrefix}-to` }}
      />
    </Stack>
  );
}
