import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
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

/** Live tab layout: chart card + step panel (the real stream needs the live backend). */
export const LiveLayout: Story = {
  parameters: { route: ['/bots/bot_1'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'ETH Arb #1' });

    await userEvent.click(canvas.getByTestId('tab-2'));

    // Mock mode: the stream is unavailable, the layout still renders.
    await expect(await canvas.findByTestId('live-mock-note')).toBeInTheDocument();
    await expect(canvas.getByText('Котировки в реальном времени')).toBeInTheDocument();
    await expect(canvas.getByTestId('step-result-panel')).toBeInTheDocument();
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
