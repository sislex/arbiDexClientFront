import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from '@storybook/test';
import { AppRoutes } from '../../app/AppRoutes';
import type { PreloadedState } from '../../store';

const authed: PreloadedState = {
  auth: { user: { address: '0xABCDEF0123456789', token: 't', isNew: false }, status: 'succeeded', error: null },
};

const meta: Meta<typeof AppRoutes> = {
  title: 'Bot/Live',
  component: AppRoutes,
  parameters: { store: authed },
};
export default meta;

type Story = StoryObj<typeof AppRoutes>;

/** Demo bot: start the stream → ticks accrue, then stop. */
export const StreamTicks: Story = {
  parameters: { route: ['/bots/bot_1'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'ETH Arb #1' });

    await userEvent.click(canvas.getByTestId('tab-2'));
    await userEvent.click(await canvas.findByTestId('live-start'));

    // Ticks accumulate while streaming.
    await waitFor(
      () => expect(Number(canvas.getByTestId('live-tick-count').textContent)).toBeGreaterThan(0),
      { timeout: 3000 },
    );

    await userEvent.click(canvas.getByTestId('live-stop'));
    await expect(await canvas.findByTestId('live-start')).toBeInTheDocument();
  },
};

/** Real-mode bot shows the on-chain warning banner. */
export const RealModeWarning: Story = {
  parameters: { route: ['/bots/bot_2'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'ETH Arb #2 (real)' });
    await userEvent.click(canvas.getByTestId('tab-2'));
    await expect(await canvas.findByTestId('real-warning')).toBeInTheDocument();
  },
};
