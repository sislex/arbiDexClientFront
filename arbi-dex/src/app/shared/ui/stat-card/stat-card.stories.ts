import type { Meta, StoryObj } from '@storybook/angular';
import { StatCardComponent } from './stat-card.component';

const meta: Meta<StatCardComponent> = {
  title: 'UI/StatCard',
  component: StatCardComponent,
  tags: ['autodocs'],
  argTypes: {
    color: { control: 'select', options: ['blue','purple','green','orange'] },
  },
};
export default meta;
type Story = StoryObj<StatCardComponent>;

export const Default: Story = {
  args: { label: 'Total Quotes', value: 128, icon: 'show_chart', color: 'blue' },
};
export const Loading: Story = {
  args: { label: 'Loading…', value: '—', icon: 'bar_chart', color: 'orange', loading: true },
};
export const Sources: Story = {
  args: { label: 'Sources', value: 4, icon: 'hub', color: 'purple' },
};
export const Subscriptions: Story = {
  args: { label: 'Subscriptions', value: 12, icon: 'bookmark', color: 'green' },
};

