import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, IconButton, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip, Typography,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { PnlValue } from '../../components/PnlValue';
import { fmtMoney } from '../../components/format';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBots } from '../../store/botsSlice';
import { fetchMarketConfigs } from '../../store/marketConfigsSlice';
import { fetchStrategyConfigs } from '../../store/strategyConfigsSlice';

export function BotsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const bots = useAppSelector((s) => s.bots.items);
  const marketConfigs = useAppSelector((s) => s.marketConfigs.items);
  const strategyConfigs = useAppSelector((s) => s.strategyConfigs.items);

  useEffect(() => {
    dispatch(fetchBots());
    dispatch(fetchMarketConfigs());
    dispatch(fetchStrategyConfigs());
  }, [dispatch]);

  return (
    <Box>
      <PageHeader
        title="Боты"
        subtitle="Все торговые боты: статус, счёт и результаты"
        actions={
          <Button variant="contained" startIcon={<AddCircleIcon />} onClick={() => navigate('/bots/new')} data-testid="add-bot">
            Добавить бота
          </Button>
        }
      />
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Пара</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Режим</TableCell>
                <TableCell>Конфигурация рынков</TableCell>
                <TableCell>Стратегия</TableCell>
                <TableCell align="right">Баланс</TableCell>
                <TableCell align="right">PnL</TableCell>
                <TableCell align="right">Сделок</TableCell>
                <TableCell align="right">Winrate</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {bots.map((b) => (
                <TableRow key={b.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/bots/${b.id}`)} data-testid={`bot-row-${b.id}`}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>{b.baseAsset}/{b.quoteAsset}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell>{b.mode === 'real-live' ? 'Реальный' : b.mode === 'demo-live' ? 'Демо' : '—'}</TableCell>
                  <TableCell>{marketConfigs.find((m) => m.id === b.marketConfigId)?.name ?? '—'}</TableCell>
                  <TableCell>{strategyConfigs.find((s) => s.id === b.strategyConfigId)?.name ?? '—'}</TableCell>
                  <TableCell align="right">{fmtMoney(b.balance, b.quoteAsset)}</TableCell>
                  <TableCell align="right"><PnlValue value={b.pnl} pct={b.pnlPct} /></TableCell>
                  <TableCell align="right">{b.tradesCount}</TableCell>
                  <TableCell align="right">{b.winRate}%</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Изменить">
                      <IconButton
                        size="small"
                        aria-label={`Изменить бота ${b.name}`}
                        data-testid={`bot-edit-${b.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/bots/${b.id}/edit`);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {bots.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      Пока нет ботов. Нажмите «Добавить бота», чтобы создать первого.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
