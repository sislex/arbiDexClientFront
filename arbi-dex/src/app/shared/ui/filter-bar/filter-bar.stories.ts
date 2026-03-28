import type { Meta, StoryObj } from '@storybook/angular';
import { FilterBarComponent } from './filter-bar.component';
import { applicationConfig } from '@storybook/angular';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

const meta: Meta<FilterBarComponent> = {
  title: 'UI/FilterBar',
  component: FilterBarComponent,
  tags: ['autodocs'],
  decorators: [applicationConfig({ providers: [provideAnimationsAsync()] })],
  argTypes: { filterChange: { action: 'filterChange' } },
};
export default meta;
type Story = StoryObj<FilterBarComponent>;

export const Default: Story = {
  args: { sourceTypeOptions: undefined },
};
export const WithTypeFilter: Story = {
  args: { sourceTypeOptions: [{ value: 'dex', label: 'DEX' }, { value: 'cex', label: 'CEX' }] },
};

