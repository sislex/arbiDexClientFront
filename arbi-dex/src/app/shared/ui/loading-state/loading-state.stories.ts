import type { Meta, StoryObj } from '@storybook/angular';
import { LoadingStateComponent } from './loading-state.component';

const meta: Meta<LoadingStateComponent> = {
  title: 'UI/LoadingState',
  component: LoadingStateComponent,
  tags: ['autodocs'],
  argTypes: { size: { control: 'select', options: ['sm','md'] } },
};
export default meta;
type Story = StoryObj<LoadingStateComponent>;

export const Default: Story = { args: { label: 'Loading…', size: 'md' } };
export const Small: Story   = { args: { label: 'Loading quotes…', size: 'sm' } };
export const NoLabel: Story = { args: { label: '', size: 'md' } };

