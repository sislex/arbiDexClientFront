import type { Meta, StoryObj } from '@storybook/angular';
import { SubscriptionsTableComponent } from './subscriptions-table.component';
import { MOCK_SOURCES } from '../../mock-data/mock-sources';
import { MOCK_PAIRS } from '../../mock-data/mock-pairs';
import { applicationConfig } from '@storybook/angular';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Subscription } from '../../models';

const MOCK_SUBS: Subscription[] = [
  { id: 'sub-1', sourceId: 'cex_binance', pairId: 'ETH_USDT',  enabled: true,  createdAt: Date.now() - 3600000 },
  { id: 'sub-2', sourceId: 'dex_arbitrum',pairId: 'USDC_WETH', enabled: true,  createdAt: Date.now() - 7200000 },
  { id: 'sub-3', sourceId: 'cex_bybit',   pairId: 'WBTC_USDC', enabled: false, createdAt: Date.now() - 10800000 },
];

const meta: Meta<SubscriptionsTableComponent> = {
  title: 'UI/SubscriptionsTable',
  component: SubscriptionsTableComponent,
  tags: ['autodocs'],
  decorators: [applicationConfig({ providers: [provideAnimationsAsync()] })],
};
export default meta;
type Story = StoryObj<SubscriptionsTableComponent>;

export const Default: Story = {
  args: { subscriptions: MOCK_SUBS, sources: MOCK_SOURCES, pairs: MOCK_PAIRS, loading: false },
};
export const Loading: Story = {
  args: { subscriptions: [], sources: [], pairs: [], loading: true },
};
export const Empty: Story = {
  args: { subscriptions: [], sources: MOCK_SOURCES, pairs: MOCK_PAIRS, loading: false },
};

