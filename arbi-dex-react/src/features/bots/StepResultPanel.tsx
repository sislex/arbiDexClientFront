import { Alert, Box, Card, CardContent, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import type { BotStepResult, StepConditionOutcome } from '../../api/types';
import { getCatalogEntry } from '../../domain/conditionsCatalog';
import { fmtTime } from '../../components/format';

/** Compact number for actual/required condition values. */
function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '∞';
  const abs = Math.abs(v);
  if (abs >= 1e6) return v.toExponential(2);
  return String(+v.toFixed(abs < 10 ? 4 : 2));
}

function ConditionRow({ id, outcome }: { id: string; outcome: StepConditionOutcome }) {
  const title = getCatalogEntry(id)?.title ?? id;
  return (
    <Stack direction="row" spacing={1} alignItems="center" data-testid={`step-cond-${id}`}>
      {outcome.passed ? (
        <CheckCircleOutlineIcon fontSize="small" color="success" />
      ) : (
        <HighlightOffIcon fontSize="small" color="error" />
      )}
      <Typography variant="body2" sx={{ flexGrow: 1 }}>{title}</Typography>
      {outcome.actual !== undefined && outcome.required !== undefined && (
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {fmtNum(outcome.actual)} / {fmtNum(outcome.required)}
        </Typography>
      )}
    </Stack>
  );
}

function SignalChip({ label, on, color }: { label: string; on: boolean; color: 'success' | 'error' | 'warning' }) {
  return <Chip size="small" label={label} color={on ? color : 'default'} variant={on ? 'filled' : 'outlined'} />;
}

/**
 * Side panel of the backtest tab: the engine's evaluation of a single step
 * (`processStep` → TradingConditionsStepResult) for the clicked chart point.
 */
export function StepResultPanel({
  result,
  loading,
  error,
}: {
  result: BotStepResult | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <Card sx={{ flexGrow: 1, minWidth: 0 }} data-testid="step-result-panel">
      <CardContent sx={{ height: '100%' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Разбор шага</Typography>
          {loading && <CircularProgress size={16} />}
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

        {!result && !loading && !error && (
          <Box sx={{ height: '85%', display: 'grid', placeItems: 'center' }}>
            <Typography color="text.secondary" variant="body2" sx={{ textAlign: 'center', px: 2 }}>
              Кликните точку на графике — стратегия будет прогнана движком на этом шаге
            </Typography>
          </Box>
        )}

        {result && (
          <Stack spacing={1.25} data-testid="step-result">
            <Typography variant="caption" color="text.secondary">
              {fmtTime((result.step.time > 1e12 ? result.step.time / 1000 : result.step.time))} · шаг{' '}
              {result.index + 1}/{result.totalSteps} · окно {result.windowSteps} шаг(ов)
            </Typography>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              <SignalChip label="Покупка" on={result.transaction.buy} color="success" />
              <SignalChip label="Продажа" on={result.transaction.sell} color="error" />
              <SignalChip label="Принуд. продажа" on={result.transaction.forcedSell} color="warning" />
            </Stack>

            <Divider textAlign="left"><Typography variant="caption">Условия покупки</Typography></Divider>
            <Stack spacing={0.75}>
              {Object.entries(result.condition.buy).map(([id, o]) => (
                <ConditionRow key={id} id={id} outcome={o} />
              ))}
            </Stack>

            <Divider textAlign="left"><Typography variant="caption">Условия продажи</Typography></Divider>
            <Stack spacing={0.75}>
              {Object.entries(result.condition.sell).map(([id, o]) => (
                <ConditionRow key={id} id={id} outcome={o} />
              ))}
            </Stack>

            <Typography variant="caption" color="text.secondary">
              bid {fmtNum(result.step.sellQuote)} · ask {fmtNum(result.step.buyQuote)} · ср.{' '}
              {fmtNum(result.step.avgObservedQuote)}
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
