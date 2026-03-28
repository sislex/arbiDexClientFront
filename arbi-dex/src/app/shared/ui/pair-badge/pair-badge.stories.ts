import type { Meta, StoryObj } from '@storybook/angular';
import { PairBadgeComponent } from './pair-badge.component';

const meta: Meta<PairBadgeComponent> = {
  title: 'UI/PairBadge',
  component: PairBadgeComponent,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<PairBadgeComponent>;

export const ETHUSDT: Story = { args: { base: 'ETH', quote: 'USDT' } };
export const WBTCUSDC: Story = { args: { base: 'WBTC', quote: 'USDC' } };
export const ARBWBTC: Story = { args: { base: 'ARB', quote: 'WBTC' } };

