import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchBots } from '../store/botsSlice';
import { fetchMarketConfigs } from '../store/marketConfigsSlice';
import { fetchStrategyConfigs } from '../store/strategyConfigsSlice';
import { fetchMarkets } from '../store/catalogSlice';

function MockDataProbe() {
  const dispatch = useAppDispatch();
  const bots = useAppSelector((s) => s.bots.items);
  const marketConfigs = useAppSelector((s) => s.marketConfigs.items);
  const strategyConfigs = useAppSelector((s) => s.strategyConfigs.items);
  const markets = useAppSelector((s) => s.catalog.markets);

  useEffect(() => {
    dispatch(fetchBots());
    dispatch(fetchMarketConfigs());
    dispatch(fetchStrategyConfigs());
    dispatch(fetchMarkets());
  }, [dispatch]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Данные из моков
      </Typography>
      <Typography color="text.secondary" gutterBottom>
        Рынков: {markets.length} · Конфигов рынков: {marketConfigs.length} · Стратегий: {strategyConfigs.length}
      </Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Бот</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Режим</TableCell>
              <TableCell align="right">PnL</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bots.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.status}</TableCell>
                <TableCell>{b.mode}</TableCell>
                <TableCell align="right">{b.pnl}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

const meta: Meta<typeof MockDataProbe> = {
  title: 'Foundation/MockData',
  component: MockDataProbe,
};
export default meta;

type Story = StoryObj<typeof MockDataProbe>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Data arrives asynchronously via thunks; findBy* waits for it.
    await expect(await canvas.findByText('ETH Arb #1')).toBeInTheDocument();
    await expect(await canvas.findByText('BTC Arb')).toBeInTheDocument();
    await expect(await canvas.findByText(/Рынков: 7/)).toBeInTheDocument();
  },
};
