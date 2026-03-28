import type { Meta, StoryObj } from '@storybook/angular';
import { SourceBadgeComponent } from './source-badge.component';

const meta: Meta<SourceBadgeComponent> = {
  title: 'UI/SourceBadge',
  component: SourceBadgeComponent,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<SourceBadgeComponent>;

export const DEX: Story = { args: { type: 'dex', displayName: 'Arbitrum DEX' } };
export const CEX: Story = { args: { type: 'cex', displayName: 'Binance' } };
export const CEXBybit: Story = { args: { type: 'cex', displayName: 'Bybit' } };

