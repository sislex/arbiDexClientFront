import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { App } from './App';

const meta: Meta<typeof App> = {
  title: 'Smoke/Scaffold',
  component: App,
};
export default meta;

type Story = StoryObj<typeof App>;

/** Unauthenticated App redirects to the login page. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: /Подключить кошелёк/ })).toBeInTheDocument();
  },
};
