import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { Box } from '@mui/material';
import { QuoteChartPanel, type ObservedSeries } from './QuoteChartPanel';
import { generateQuoteSeries } from '../../mocks/quotes';
import type { Trade } from '../../domain/types';

const quotes = generateQuoteSeries({ seed: 'chart-demo', count: 180, intervalSec: 60, endTime: 1783555200, basePrice: 3200 });

const observed: ObservedSeries[] = [
  { id: 'binance', label: 'Binance', data: generateQuoteSeries({ seed: 'binance', count: 180, intervalSec: 60, endTime: 1783555200, basePrice: 3200 }).map((q) => ({ time: q.time, value: q.avgObservedQuote })) },
  { id: 'coinbase', label: 'Coinbase', data: generateQuoteSeries({ seed: 'coinbase', count: 180, intervalSec: 60, endTime: 1783555200, basePrice: 3201 }).map((q) => ({ time: q.time, value: q.avgObservedQuote })) },
  { id: 'kraken', label: 'Kraken', data: generateQuoteSeries({ seed: 'kraken', count: 180, intervalSec: 60, endTime: 1783555200, basePrice: 3199 }).map((q) => ({ time: q.time, value: q.avgObservedQuote })) },
];

const trades: Trade[] = [
  { id: 't1', time: quotes[40].time, side: 'buy', price: quotes[40].buyQuote, amount: 0.3 },
  { id: 't2', time: quotes[90].time, side: 'sell', price: quotes[90].sellQuote, amount: 0.3, pnl: 12 },
  { id: 't3', time: quotes[130].time, side: 'buy', price: quotes[130].buyQuote, amount: 0.3 },
];

const meta: Meta<typeof QuoteChartPanel> = {
  title: 'Chart/QuoteChartPanel',
  component: QuoteChartPanel,
  decorators: [(Story) => <Box sx={{ p: 3, width: 900 }}><Story /></Box>],
};
export default meta;

type Story = StoryObj<typeof QuoteChartPanel>;

/** Observed markets shown as separate lines; toggle collapses to weighted avg. */
export const WeightedToggle: Story = {
  args: { quotes, observed, hasTradingMarket: true, trades },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const legend = await canvas.findByTestId('chart-legend');
    const legendScope = within(legend);
    // Initially the three observed markets are individual lines.
    await expect(legendScope.getByText('Binance')).toBeInTheDocument();
    await expect(legendScope.getByText('Coinbase')).toBeInTheDocument();
    // Trading lines present too.
    await expect(legendScope.getByText('Цена покупки')).toBeInTheDocument();
    await expect(legendScope.getByText('Цена продажи')).toBeInTheDocument();
    await expect(canvas.getByTestId('quote-chart')).toBeInTheDocument();

    // Collapse to the weighted-average line.
    await userEvent.click(canvas.getByTestId('toggle-weighted'));
    await expect(await legendScope.findByText('Средневзвешенная')).toBeInTheDocument();
    await expect(legendScope.queryByText('Binance')).not.toBeInTheDocument();
  },
};

/** Reference-only panel (no trading market): always the weighted line. */
export const ReferenceOnly: Story = {
  args: { quotes, observed, hasTradingMarket: false },
};

/** History player + zoom controls. */
export const PlayerAndZoom: Story = {
  args: { quotes, observed, hasTradingMarket: true, trades, player: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Player present.
    await expect(await canvas.findByTestId('history-player')).toBeInTheDocument();
    await expect(canvas.getByTestId('player-slider')).toBeInTheDocument();
    const time = canvas.getByTestId('player-time');
    await expect(time).toHaveTextContent(/\d+\/\d+/);

    // Zoom controls work (no throw, chart stays mounted).
    await userEvent.click(canvas.getByTestId('zoom-in'));
    await userEvent.click(canvas.getByTestId('zoom-in'));
    await userEvent.click(canvas.getByTestId('zoom-out'));
    await userEvent.click(canvas.getByTestId('zoom-reset'));
    await expect(canvas.getByTestId('quote-chart')).toBeInTheDocument();

    // Play → pause.
    await userEvent.click(canvas.getByTestId('player-toggle'));
    await userEvent.click(canvas.getByTestId('player-toggle'));
    await expect(canvas.getByTestId('history-player')).toBeInTheDocument();
  },
};
