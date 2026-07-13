import { Card, CardContent, Stack, Switch, Typography, FormControlLabel, Chip, Box } from '@mui/material';
import type { StrategyConditionValue, TuneRange } from '../../domain/types';
import type { ConditionCatalogEntry } from '../../domain/conditionsCatalog';
import { CoefficientField } from './CoefficientField';
import { RangeField } from './RangeField';

/** Editor for a single condition: enable switch + coefficient fields + tune ranges. */
export function ConditionEditor({
  entry,
  value,
  onChange,
  showTuning,
  side,
}: {
  entry: ConditionCatalogEntry;
  value: StrategyConditionValue;
  onChange: (next: StrategyConditionValue) => void;
  showTuning: boolean;
  side: 'buy' | 'sell';
}) {
  const setParam = (key: string, v: number | boolean) =>
    onChange({ ...value, params: { ...value.params, [key]: v } });
  const setRange = (key: string, r: TuneRange) =>
    onChange({ ...value, tuneRanges: { ...value.tuneRanges, [key]: r } });

  return (
    <Card variant="outlined" sx={{ opacity: value.enabled ? 1 : 0.6 }} data-testid={`cond-${side}-${entry.id}`}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">{entry.title}</Typography>
              <Chip size="small" variant="outlined" label={entry.kind === 'gate' ? 'gate' : 'trigger'} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {entry.description}
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={value.enabled}
                onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
                inputProps={{ 'data-testid': `cond-${side}-${entry.id}-toggle` } as never}
              />
            }
            label=""
          />
        </Stack>

        {value.enabled && (
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            {entry.params.map((p) => {
              if (p.type === 'boolean') {
                return (
                  <FormControlLabel
                    key={p.key}
                    control={
                      <Switch
                        size="small"
                        checked={!!value.params[p.key]}
                        onChange={(e) => setParam(p.key, e.target.checked)}
                      />
                    }
                    label={<Typography variant="body2">{p.label}</Typography>}
                  />
                );
              }
              return (
                <Box key={p.key}>
                  <CoefficientField
                    label={p.label}
                    unit={p.unit}
                    value={Number(value.params[p.key])}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    onChange={(v) => setParam(p.key, v)}
                    testid={`param-${side}-${entry.id}-${p.key}`}
                  />
                  {showTuning && p.tunable && value.tuneRanges[p.key] && (
                    <RangeField
                      label={p.label}
                      value={value.tuneRanges[p.key]}
                      onChange={(r) => setRange(p.key, r)}
                      testidPrefix={`tune-${side}-${entry.id}-${p.key}`}
                    />
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
