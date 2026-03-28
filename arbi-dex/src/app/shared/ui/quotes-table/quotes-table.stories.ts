import type { Meta, StoryObj } from '@storybook/angular';
import { QuotesTableComponent } from './quotes-table.component';
import { MOCK_QUOTES } from '../../mock-data/mock-quotes';
import { MOCK_SOURCES } from '../../mock-data/mock-sources';
import { MOCK_PAIRS } from '../../mock-data/mock-pairs';
import { applicationConfig } from '@storybook/angular';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

const meta: Meta<QuotesTableComponent> = {
  title: 'UI/QuotesTable',
  component: QuotesTableComponent,
  tags: ['autodocs'],
  decorators: [applicationConfig({ providers: [provideAnimationsAsync()] })],
};
export default meta;
type Story = StoryObj<QuotesTableComponent>;

export const Default: Story = {
  args: { quotes: MOCK_QUOTES, sources: MOCK_SOURCES, pairs: MOCK_PAIRS, loading: false },
};
export const Loading: Story = {
  args: { quotes: [], sources: [], pairs: [], loading: true },
};
export const Empty: Story = {
  args: { quotes: [], sources: MOCK_SOURCES, pairs: MOCK_PAIRS, loading: false },
};

