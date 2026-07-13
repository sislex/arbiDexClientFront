import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { AppRoutes } from '../../app/AppRoutes';
import type { PreloadedState } from '../../store';

const authed: PreloadedState = {
  auth: { user: { address: '0xABCDEF0123456789', token: 't', isNew: false }, status: 'succeeded', error: null },
};

const meta: Meta<typeof AppRoutes> = {
  title: 'Bot/Backtest',
  component: AppRoutes,
  parameters: { store: authed, route: ['/bots/bot_1'] },
};
export default meta;

type Story = StoryObj<typeof AppRoutes>;

/** Running a historical backtest produces stats, a chart with markers and a trades table. */
export const RunBacktest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'ETH Arb #1' });

    // Go to the Backtest tab and run it.
    await userEvent.click(canvas.getByTestId('tab-1'));
    await userEvent.click(await canvas.findByTestId('run-backtest'));

    // Result block with stats appears.
    await expect(await canvas.findByTestId('bt-result')).toBeInTheDocument();
    await expect(await canvas.findByText('Итоговый баланс')).toBeInTheDocument();
    await expect(await canvas.findByText('Макс. просадка')).toBeInTheDocument();

    // Trades table has at least one executed trade.
    const table = within(await canvas.findByTestId('trades-table'));
    await expect((await table.findAllByText(/Покупка|Продажа/)).length).toBeGreaterThan(0);

    // Chart legend shows buy/sell lines.
    const legend = within(await canvas.findByTestId('chart-legend'));
    await expect(await legend.findByText('Цена покупки')).toBeInTheDocument();
  },
};
