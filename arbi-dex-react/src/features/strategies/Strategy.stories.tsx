import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { AppRoutes } from '../../app/AppRoutes';
import type { PreloadedState } from '../../store';

const authed: PreloadedState = {
  auth: { user: { address: '0xABCDEF0123456789', token: 't', isNew: false }, status: 'succeeded', error: null },
};

const meta: Meta<typeof AppRoutes> = {
  title: 'Strategy/Editor',
  component: AppRoutes,
  parameters: { store: authed },
};
export default meta;

type Story = StoryObj<typeof AppRoutes>;

export const List: Story = {
  parameters: { route: ['/strategies'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Консервативная (0.5% / стоп-2%)')).toBeInTheDocument();
  },
};

/** Create a strategy: set a coefficient, reveal tune ranges, save. */
export const CreateAndEditCoefficient: Story = {
  parameters: { route: ['/strategies/new'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const name = await canvas.findByTestId('strategy-name');
    await userEvent.type(name, 'Тестовая стратегия');

    // Edit the buy deviation threshold coefficient.
    const percent = canvas.getByTestId('param-buy-avg_observed_higher_for_last_steps-percent');
    await userEvent.clear(percent);
    await userEvent.type(percent, '0.8');
    await expect(percent).toHaveValue(0.8);

    // Tune ranges are hidden until the toggle is on.
    await expect(canvas.queryByTestId('tune-buy-avg_observed_higher_for_last_steps-percent-min')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByTestId('toggle-tuning'));
    await expect(await canvas.findByTestId('tune-buy-avg_observed_higher_for_last_steps-percent-min')).toBeInTheDocument();

    // Disable a sell trigger to prove toggles work.
    await userEvent.click(canvas.getByTestId('cond-sell-stop_loss-toggle'));

    // Save → strategy appears in the list.
    await userEvent.click(canvas.getByTestId('save-strategy'));
    await expect(await canvas.findByText('Тестовая стратегия')).toBeInTheDocument();
  },
};
