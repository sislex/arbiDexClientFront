import type { Meta, StoryObj } from '@storybook/angular';
import { PageHeaderComponent } from './page-header.component';

const meta: Meta<PageHeaderComponent> = {
  title: 'UI/PageHeader',
  component: PageHeaderComponent,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<PageHeaderComponent>;

export const Default: Story = {
  args: { title: 'Dashboard' },
};
export const WithSubtitle: Story = {
  args: { title: 'Market Catalog', subtitle: 'Browse available sources and trading pairs' },
};

