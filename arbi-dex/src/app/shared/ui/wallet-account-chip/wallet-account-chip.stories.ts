import type { Meta, StoryObj } from '@storybook/angular';
import { WalletAccountChipComponent } from './wallet-account-chip.component';
import { importProvidersFrom } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

const meta: Meta<WalletAccountChipComponent> = {
  title: 'UI/WalletAccountChip',
  component: WalletAccountChipComponent,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<WalletAccountChipComponent>;

export const Default: Story = {
  args: { address: '0x742d35Cc6634C0532925a3b8D4C9B8f3e4F4B3e' },
};
export const WithProvider: Story = {
  args: { address: '0x742d35Cc6634C0532925a3b8D4C9B8f3e4F4B3e', provider: 'MetaMask' },
};

