import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { AppRoutes } from '../../app/AppRoutes';
import type { PreloadedState } from '../../store';

const authed: PreloadedState = {
  auth: { user: { address: '0xABCDEF0123456789', token: 't', isNew: false }, status: 'succeeded', error: null },
};

const meta: Meta<typeof AppRoutes> = {
  title: 'Dashboard/Page',
  component: AppRoutes,
  parameters: { store: authed, route: ['/dashboard'] },
};
export default meta;

type Story = StoryObj<typeof AppRoutes>;

/** All seeded bots render as cards with status/PnL. */
export const ListsBots: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('ETH Arb #1')).toBeInTheDocument();
    await expect(await canvas.findByText('ETH Arb #2 (real)')).toBeInTheDocument();
    await expect(await canvas.findByText('BTC Arb')).toBeInTheDocument();
    await expect(await canvas.findByText('BTC Scalper')).toBeInTheDocument();
    // KPI row
    await expect(await canvas.findByText('Суммарный PnL')).toBeInTheDocument();
  },
};

/** Clicking a bot card navigates to its detail page. */
export const OpensBotDetail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByTestId('bot-card-bot_1');
    await userEvent.click(card);
    await expect(await canvas.findByRole('heading', { name: 'ETH Arb #1' })).toBeInTheDocument();
  },
};
