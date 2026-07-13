import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, screen } from '@storybook/test';
import { AppRoutes } from '../../app/AppRoutes';
import type { PreloadedState } from '../../store';

const authed: PreloadedState = {
  auth: { user: { address: '0xABCDEF0123456789', token: 't', isNew: false }, status: 'succeeded', error: null },
};

const meta: Meta<typeof AppRoutes> = {
  title: 'Bot/AddWizard',
  component: AppRoutes,
  parameters: { store: authed, route: ['/bots/new'] },
};
export default meta;

type Story = StoryObj<typeof AppRoutes>;

/** Full wizard: name → market config → strategy → review → create → detail. */
export const CreateBot: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Step 1 — name
    await userEvent.type(await canvas.findByTestId('bot-name'), 'Новый бот');
    await userEvent.click(canvas.getByTestId('wizard-next'));

    // Step 2 — market config (MUI select opens in a portal)
    await userEvent.click(await canvas.findByRole('combobox'));
    await userEvent.click(await screen.findByText('ETH — Uniswap vs CEX'));
    await userEvent.click(canvas.getByTestId('wizard-next'));

    // Step 3 — strategy
    await userEvent.click(await canvas.findByRole('combobox'));
    await userEvent.click(await screen.findByText('Консервативная (0.5% / стоп-2%)'));
    await userEvent.click(canvas.getByTestId('wizard-next'));

    // Step 4 — review + create
    const review = within(await canvas.findByTestId('wizard-review'));
    await expect(review.getByText('Новый бот')).toBeInTheDocument();
    await userEvent.click(canvas.getByTestId('wizard-create'));

    // Lands on the new bot's detail page.
    await expect(await canvas.findByRole('heading', { name: 'Новый бот' })).toBeInTheDocument();
  },
};
