import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { AppRoutes } from '../../app/AppRoutes';

const meta: Meta<typeof AppRoutes> = {
  title: 'Auth/Login flow',
  component: AppRoutes,
  parameters: { route: ['/login'] },
};
export default meta;

type Story = StoryObj<typeof AppRoutes>;

/** The login page renders and the connect button is present. */
export const LoginPage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('ArbiDex')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: /Подключить кошелёк/ })).toBeInTheDocument();
  },
};

/** Connecting a wallet authenticates and routes to the dashboard (guard passes). */
export const ConnectRedirectsToDashboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const btn = await canvas.findByRole('button', { name: /Подключить кошелёк/ });
    await userEvent.click(btn);
    // After auth the guard lets us into the shell → dashboard heading appears.
    await expect(await canvas.findByRole('heading', { name: 'Дашборд' })).toBeInTheDocument();
    // Wallet chip is shown in the topbar once authenticated.
    await expect(await canvas.findByText(/Выйти/)).toBeInTheDocument();
  },
};
