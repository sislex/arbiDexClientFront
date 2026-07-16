import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, screen } from '@storybook/test';
import { AppRoutes } from '../../app/AppRoutes';
import type { PreloadedState } from '../../store';

const authed: PreloadedState = {
  auth: { user: { address: '0xABCDEF0123456789', token: 't', isNew: false }, status: 'succeeded', error: null },
};

const meta: Meta<typeof AppRoutes> = {
  title: 'Bot/Autotune',
  component: AppRoutes,
  parameters: { store: authed, route: ['/bots/bot_1'] },
};
export default meta;

type Story = StoryObj<typeof AppRoutes>;

/** Sweep coefficient ranges → ranked grid + best combo → apply. */
export const RunAutotune: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'ETH Arb #1' });

    await userEvent.click(canvas.getByTestId('tab-3'));
    // Tuned dimensions are listed.
    await expect(await canvas.findByText('Подбираются:')).toBeInTheDocument();

    await userEvent.click(await canvas.findByTestId('run-autotune'));

    // Results with a best combo and a ranked grid.
    await expect(await canvas.findByTestId('at-result')).toBeInTheDocument();
    await expect(await canvas.findByText(/Лучшая комбинация из/)).toBeInTheDocument();

    const grid = within(await canvas.findByTestId('at-grid'));
    const rows = await grid.findAllByRole('row');
    // Header + several combo rows.
    await expect(rows.length).toBeGreaterThan(2);

    // Ranked by PnL: first combo's PnL ≥ last combo's PnL.
    const pnls = grid.getAllByText(/^[+-]/).map((el) => parseFloat(el.textContent!.replace('+', '')));
    await expect(pnls[0]).toBeGreaterThanOrEqual(pnls[pnls.length - 1]);

    // Apply the best combo → choice dialog (portal) → apply to the current strategy.
    await userEvent.click(canvas.getByTestId('apply-best'));
    await userEvent.click(await screen.findByTestId('apply-current'));
    await expect(await screen.findByText('Коэффициенты применены к текущей стратегии')).toBeInTheDocument();
  },
};
