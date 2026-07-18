import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Card, CardContent, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import type { Bot, BotSession } from '../../domain/types';
import { PnlValue } from '../../components/PnlValue';
import { fmtDuration, fmtTime } from '../../components/format';
import { api, IS_LIVE } from '../../api';

/**
 * Сессии бота: одна строка — один запуск (от «Запустить» до «Стоп»). Текущая
 * сессия сверху с бейджем «идёт». Клик по строке — страница сессии: активная
 * выглядит как вкладка «Реальное время», завершённая — как бэктест.
 */
export function SessionsTab({ bot }: { bot: Bot }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<BotSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!IS_LIVE) return;
    let alive = true;
    const load = () =>
      api.bots
        .sessions(bot.id)
        .then((s) => {
          if (alive) {
            setSessions(s);
            setError(null);
          }
        })
        .catch((e) => setError((e as Error).message));
    load();
    const t = window.setInterval(load, 20_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [bot.id]);

  if (!IS_LIVE) {
    return (
      <Alert severity="info" data-testid="sessions-mock-note">
        Сессии доступны только в live-режиме (нужен сервер).
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: 0 }}>
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
        <Box sx={{ overflow: 'auto' }}>
          <Table size="small" data-testid="sessions-table">
            <TableHead>
              <TableRow>
                <TableCell>Начало</TableCell>
                <TableCell>Конец</TableCell>
                <TableCell>Длительность</TableCell>
                <TableCell>Режим</TableCell>
                <TableCell align="right">Сделок</TableCell>
                <TableCell align="right">Неудачных</TableCell>
                <TableCell align="right">Результат</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s) => (
                <TableRow
                  key={s.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/bots/${bot.id}/sessions/${s.id}`)}
                  data-testid={`session-row-${s.id}`}
                >
                  <TableCell>{fmtTime(s.startedAt / 1000)}</TableCell>
                  <TableCell>
                    {s.active ? (
                      <Chip size="small" color="success" variant="outlined" label="идёт" />
                    ) : (
                      fmtTime(s.endedAt / 1000)
                    )}
                  </TableCell>
                  <TableCell>{fmtDuration((s.active ? Date.now() : s.endedAt) - s.startedAt)}</TableCell>
                  <TableCell>{s.mode === 'real-live' ? 'Реальный' : s.mode === 'demo-live' ? 'Демо' : '—'}</TableCell>
                  <TableCell align="right">{s.tradesCount}</TableCell>
                  <TableCell align="right">
                    {s.failedCount > 0 ? (
                      <Typography component="span" variant="body2" color="error.main">{s.failedCount}</Typography>
                    ) : (
                      0
                    )}
                  </TableCell>
                  <TableCell align="right"><PnlValue value={s.pnl} pct={s.pnlPct} /></TableCell>
                </TableRow>
              ))}
              {sessions.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" sx={{ py: 2, px: 1 }}>
                      Сессий ещё нет — запустите бота, сессия появится автоматически.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
}
