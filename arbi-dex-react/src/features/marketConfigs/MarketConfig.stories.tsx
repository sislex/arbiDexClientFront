import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, screen } from '@storybook/test';
import { AppRoutes } from '../../app/AppRoutes';
import type { PreloadedState } from '../../store';

const authed: PreloadedState = {
  auth: { user: { address: '0xABCDEF0123456789', token: 't', isNew: false }, status: 'succeeded', error: null },
};

const meta: Meta<typeof AppRoutes> = {
  title: 'MarketConfig/Builder',
  component: AppRoutes,
  parameters: { store: authed },
};
export default meta;

type Story = StoryObj<typeof AppRoutes>;

/** Existing configs are listed. */
export const List: Story = {
  parameters: { route: ['/market-configs'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('ETH — Uniswap vs CEX')).toBeInTheDocument();
    await expect(await canvas.findByText('BTC — Uniswap vs CEX')).toBeInTheDocument();
  },
};

/** Build a new config: name, observed markets, trading market → buy/sell lines. */
export const CreateConfig: Story = {
  parameters: { route: ['/market-configs/new'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Name
    const name = await canvas.findByTestId('mc-name');
    await userEvent.type(name, 'Моя ETH-конфигурация');

    // Add an observed market via the autocomplete (options render in a portal → screen).
    await userEvent.click(canvas.getByTestId('observed-picker'));
    await userEvent.click(await screen.findByText('Binance · ETH/USDT'));
    await userEvent.click(canvas.getByTestId('add-observed'));
    const observedList = within(canvas.getByTestId('observed-list'));
    await expect(await observedList.findByText('Binance · ETH/USDT')).toBeInTheDocument();

    // Add a trading market (DEX) → buy/sell lines appear in the legend.
    await userEvent.click(canvas.getByTestId('trading-picker'));
    await userEvent.click(await screen.findByText('Uniswap v3 · WETH/USDC'));
    const legend = within(await canvas.findByTestId('chart-legend'));
    await expect(await legend.findByText('Цена покупки')).toBeInTheDocument();
    await expect(await legend.findByText('Цена продажи')).toBeInTheDocument();

    // Save → back to the list, new config present.
    const save = canvas.getByTestId('save-market-config');
    await expect(save).toBeEnabled();
    await userEvent.click(save);
    await expect(await canvas.findByText('Моя ETH-конфигурация')).toBeInTheDocument();
  },
};
