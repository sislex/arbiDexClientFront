import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Stack, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { api } from '../../api';
import type { FollowAnalysis, FollowEvent } from '../../api/types';
import { usePeriod } from '../bots/usePeriod';
import { PeriodPicker } from '../bots/PeriodPicker';
import { StatCard } from '../../components/StatCard';
import { fmtDuration, fmtTime } from '../../components/format';

/**
 * «Анализ следования»: how often the trading market repeats significant moves
 * of the observed markets. Server-side computation over the selected period;
 * requires a SAVED config (the analysis runs against the stored markets).
 */
export function FollowAnalysisCard({
  configId,
  disabledReason,
  onEventClick,
}: {
  /** Saved config id; undefined for a new (unsaved) config. */
  configId?: string;
  /** Non-null → the run button is disabled with this tooltip (unsaved changes). */
  disabledReason?: string | null;
  /** Event row click — e.g. to highlight the event's step on the preview chart. */
  onEventClick?: (event: FollowEvent) => void;
}) {
  const period = usePeriod(configId, 'marketConfig');
  const [movePct, setMovePct] = useState(0.05);
  const [windowSteps, setWindowSteps] = useState(5);
  const [result, setResult] = useState<FollowAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);

  const pickEvent = (e: FollowEvent) => {
    setSelectedEvent(e.time);
    onEventClick?.(e);
  };

  const disabled = !configId || !!disabledReason || loading;

  const run = async () => {
    if (!configId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(
        await api.marketConfigs.followAnalysis(configId, {
          movePct,
          window: windowSteps,
          from: period.from ?? undefined,
          to: period.to ?? undefined,
        }),
      );
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>Анализ следования</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Как часто торговый рынок повторяет значимые движения наблюдаемых за выбранный период.
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
          <PeriodPicker period={period} idPrefix="fa" />
          <TextField
            label="Порог движения" size="small" type="number" value={movePct}
            onChange={(e) => setMovePct(Number(e.target.value))}
            inputProps={{ step: 0.01, min: 0.001, 'data-testid': 'fa-move-pct' }}
            sx={{ width: 140 }}
            InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">%</Typography> }}
          />
          <TextField
            label="Окно ожидания" size="small" type="number" value={windowSteps}
            onChange={(e) => setWindowSteps(Number(e.target.value))}
            inputProps={{ step: 1, min: 1, 'data-testid': 'fa-window' }}
            sx={{ width: 140 }}
            InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">шагов</Typography> }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title={disabledReason ?? ''}>
            <span>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <QueryStatsIcon />}
                onClick={run}
                disabled={disabled}
                data-testid="fa-run"
              >
                Проверить следование
              </Button>
            </span>
          </Tooltip>
        </Stack>

        {error && <Alert severity="error" sx={{ mt: 2 }} data-testid="fa-error">{error}</Alert>}

        {result && (
          <Box sx={{ mt: 2 }} data-testid="fa-result">
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
              <StatCard
                label="Следование"
                value={
                  <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
                    {result.followRate}%
                  </Typography>
                }
              />
              <StatCard label="Вверх" value={`${result.up.followRate}% (${result.up.followed}/${result.up.events})`} />
              <StatCard label="Вниз" value={`${result.down.followRate}% (${result.down.followed}/${result.down.events})`} />
              <StatCard label="Событий" value={`${result.events} из ${result.totalSteps} шагов`} />
              <StatCard
                label="Ср. задержка"
                value={
                  result.avgLagSteps != null
                    ? `${result.avgLagSteps} шаг(ов)${result.avgLagMs != null ? ` · ${fmtDuration(result.avgLagMs)}` : ''}`
                    : '—'
                }
              />
              <StatCard label="Время расчёта" value={fmtDuration(result.tookMs)} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
              <Chip size="small" variant="outlined" label={`порог ${result.movePct}%`} />
              <Chip size="small" variant="outlined" label={`окно ${result.windowSteps} шаг(ов)`} />
            </Stack>
            {result.events === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                За период не было движений наблюдаемых рынков сильнее порога — уменьшите порог или расширьте период.
              </Typography>
            )}

            {result.eventList.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  События ({result.eventList.length}) — клик выделяет шаг на графике
                </Typography>
                <Box sx={{ maxHeight: 280, overflow: 'auto' }} data-testid="fa-events">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Время</TableCell>
                        <TableCell>Направление</TableCell>
                        <TableCell align="right">Движение</TableCell>
                        <TableCell>Следование</TableCell>
                        <TableCell align="right">Задержка</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.eventList.map((e) => (
                        <TableRow
                          key={e.time}
                          hover
                          selected={selectedEvent === e.time}
                          onClick={() => pickEvent(e)}
                          sx={{ cursor: 'pointer' }}
                          data-testid={`fa-event-${e.time}`}
                        >
                          <TableCell>{fmtTime(e.time > 1e12 ? e.time / 1000 : e.time)}</TableCell>
                          <TableCell>
                            {e.direction === 'up' ? (
                              <Chip size="small" variant="outlined" color="success" icon={<ArrowUpwardIcon />} label="вверх" />
                            ) : (
                              <Chip size="small" variant="outlined" color="error" icon={<ArrowDownwardIcon />} label="вниз" />
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {e.movedPct > 0 ? '+' : ''}{e.movedPct}%
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={e.followed ? 'последовал' : 'нет'}
                              color={e.followed ? 'success' : 'default'}
                              variant={e.followed ? 'filled' : 'outlined'}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {e.lagSteps != null ? `${e.lagSteps} шаг(ов)` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            )}
          </Box>
        )}
        {!result && !error && (
          <Divider sx={{ mt: 2, opacity: 0 }} />
        )}
      </CardContent>
    </Card>
  );
}
