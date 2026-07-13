import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { AppRoutes } from '../../app/AppRoutes';
import type { PreloadedState } from '../../store';

const authed: PreloadedState = {
  auth: { user: { address: '0xABCDEF0123456789', token: 't', isNew: false }, status: 'succeeded', error: null },
};

const meta: Meta<typeof AppRoutes> = {
  title: 'Bot/Detail',
  component: AppRoutes,
  parameters: { store: authed, route: ['/bots/bot_1'] },
};
export default meta;

type Story = StoryObj<typeof AppRoutes>;

/** Overview shows stats + market/strategy config summary; tabs switch. */
export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'ETH Arb #1' })).toBeInTheDocument();
    // Stats
    await expect(await canvas.findByText('Winrate')).toBeInTheDocument();
    // Config summaries
    await expect(await canvas.findByText('ETH — Uniswap vs CEX')).toBeInTheDocument();
    await expect(await canvas.findByText('Консервативная (0.5% / стоп-2%)')).toBeInTheDocument();

    // Switch to the Backtest tab.
    await userEvent.click(canvas.getByTestId('tab-1'));
    await expect(await canvas.findByTestId('run-backtest')).toBeInTheDocument();
  },
};

/** Lifecycle controls update the bot status. */
export const PauseControl: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // bot_1 is running → Pause button present.
    const pause = await canvas.findByTestId('bot-pause');
    await userEvent.click(pause);
    await expect(await canvas.findByText('Пауза')).toBeInTheDocument();
    // Now a Start button appears.
    await expect(await canvas.findByTestId('bot-start')).toBeInTheDocument();
  },
};
