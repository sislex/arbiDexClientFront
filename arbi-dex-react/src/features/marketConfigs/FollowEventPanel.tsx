import { Box, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { FollowEvent } from '../../api/types';
import { fmtDuration, fmtTime } from '../../components/format';

/** Compact number for prices/percents. */
function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '∞';
  const abs = Math.abs(v);
  if (abs >= 1e6) return v.toExponential(2);
  return String(+v.toFixed(abs < 10 ? 4 : 2));
}

function CheckRow({
  title,
  passed,
  actual,
  required,
}: {
  title: string;
  passed: boolean;
  actual: number;
  required: number;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {passed ? (
        <CheckCircleOutlineIcon fontSize="small" color="success" />
      ) : (
        <HighlightOffIcon fontSize="small" color="error" />
      )}
      <Typography variant="body2" sx={{ flexGrow: 1 }}>{title}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {fmtNum(actual)}% / {fmtNum(required)}%
      </Typography>
    </Stack>
  );
}

/**
 * Side panel of the follow analysis: the breakdown of a clicked event in the
 * backtest step-inspector style — checks with actual/required, lag and quotes.
 */
export function FollowEventPanel({
  event,
  movePct,
  windowSteps,
  unitMs,
}: {
  event: FollowEvent | null;
  movePct: number;
  windowSteps: number;
  /** Whether event times are in ms (for lag formatting). */
  unitMs: boolean;
}) {
  return (
    <Card sx={{ flexGrow: 1, minWidth: 0 }} data-testid="fa-event-panel">
      <CardContent sx={{ height: '100%' }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Разбор события</Typography>

        {!event ? (
          <Box sx={{ height: '85%', display: 'grid', placeItems: 'center' }}>
            <Typography color="text.secondary" variant="body2" sx={{ textAlign: 'center', px: 2 }}>
              Кликните событие в таблице — здесь появится его разбор
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.25} data-testid="fa-event-breakdown">
            <Typography variant="caption" color="text.secondary">
              {fmtTime(event.time > 1e12 ? event.time / 1000 : event.time)} · шаг {event.index + 1}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {event.direction === 'up' ? (
                <Chip size="small" color="success" icon={<ArrowUpwardIcon />} label="движение вверх" />
              ) : (
                <Chip size="small" color="error" icon={<ArrowDownwardIcon />} label="движение вниз" />
              )}
              <Chip
                size="small"
                label={event.followed ? 'последовал' : 'не последовал'}
                color={event.followed ? 'success' : 'default'}
                variant={event.followed ? 'filled' : 'outlined'}
              />
            </Stack>

            <Divider textAlign="left"><Typography variant="caption">Проверки</Typography></Divider>
            <Stack spacing={0.75}>
              <CheckRow
                title="Движение наблюдаемых ≥ порога"
                passed
                actual={event.movedPct}
                required={event.direction === 'up' ? movePct : -movePct}
              />
              <CheckRow
                title={`Торговый повторил за ${windowSteps} шаг(ов)`}
                passed={event.followed}
                actual={event.tradingMovePct}
                required={event.direction === 'up' ? movePct : -movePct}
              />
            </Stack>

            <Divider textAlign="left"><Typography variant="caption">Детали</Typography></Divider>
            <Stack spacing={0.5}>
              <Row k="Наблюдаемая (до → после)" v={`${fmtNum(event.observedBefore)} → ${fmtNum(event.observedAfter)}`} />
              <Row k="Mid торгового (база)" v={fmtNum(event.baseMid)} />
              {event.midAtFollow != null && <Row k="Mid при догоне" v={fmtNum(event.midAtFollow)} />}
              <Row
                k="Задержка"
                v={
                  event.lagSteps != null && event.followedAt != null
                    ? `${event.lagSteps} шаг(ов) · ${fmtDuration(
                        (event.followedAt - event.time) * (unitMs ? 1 : 1000),
                      )}`
                    : '—'
                }
              />
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={1}>
      <Typography variant="body2" color="text.secondary">{k}</Typography>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
    </Stack>
  );
}
