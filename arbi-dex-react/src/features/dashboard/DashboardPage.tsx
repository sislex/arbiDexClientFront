import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, CircularProgress, Typography } from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
import { PnlValue } from '../../components/PnlValue';
import { fmtMoney } from '../../components/format';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBots } from '../../store/botsSlice';
import { BotCard } from './BotCard';

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: bots, status } = useAppSelector((s) => s.bots);

  useEffect(() => {
    if (status === 'idle') dispatch(fetchBots());
  }, [status, dispatch]);

  const totalPnl = bots.reduce((a, b) => a + b.pnl, 0);
  const totalBalance = bots.reduce((a, b) => a + b.balance, 0);
  const running = bots.filter((b) => b.status === 'running').length;

  return (
    <Box>
      <PageHeader
        title="Дашборд"
        subtitle="Запущенные боты автоторговли"
        actions={
          <Button variant="contained" startIcon={<AddCircleIcon />} onClick={() => navigate('/bots/new')}>
            Добавить бота
          </Button>
        }
      />

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        <StatCard label="Ботов" value={bots.length} sub={<Typography variant="caption" color="text.secondary">{running} работают</Typography>} />
        <StatCard label="Суммарный PnL" value={<PnlValue value={totalPnl} variant="h6" />} />
        <StatCard label="Суммарный баланс" value={fmtMoney(totalBalance)} />
      </Stack>

      {status === 'loading' && bots.length === 0 ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} onOpen={(id) => navigate(`/bots/${id}`)} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
