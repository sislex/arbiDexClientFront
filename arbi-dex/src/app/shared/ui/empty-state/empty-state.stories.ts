import type { Meta, StoryObj } from '@storybook/angular';
import { EmptyStateComponent } from './empty-state.component';

const meta: Meta<EmptyStateComponent> = {
  title: 'UI/EmptyState',
  component: EmptyStateComponent,
  tags: ['autodocs'],
  argTypes: { action: { action: 'action' } },
};
export default meta;
type Story = StoryObj<EmptyStateComponent>;

export const Default: Story = {
  args: { icon: 'inbox', title: 'Nothing here yet' },
};
export const WithDescription: Story = {
  args: { icon: 'bookmark_border', title: 'No subscriptions', description: 'Add sources and pairs to get started' },
};
export const WithAction: Story = {
  args: { icon: 'show_chart', title: 'No quotes', description: 'Subscribe to pairs to see quotes', actionLabel: 'Go to Market' },
};

