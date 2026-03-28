import type { Meta, StoryObj } from '@storybook/angular';
import { StatusBadgeComponent } from './status-badge.component';

const meta: Meta<StatusBadgeComponent> = {
  title: 'UI/StatusBadge',
  component: StatusBadgeComponent,
  tags: ['autodocs'],
  argTypes: { status: { control: 'select', options: ['active','inactive','error','warning'] } },
};
export default meta;
type Story = StoryObj<StatusBadgeComponent>;

export const Active: Story   = { args: { status: 'active' } };
export const Inactive: Story = { args: { status: 'inactive' } };
export const Error: Story    = { args: { status: 'error' } };
export const Warning: Story  = { args: { status: 'warning' } };
export const CustomLabel: Story = { args: { status: 'active', label: 'Online' } };

