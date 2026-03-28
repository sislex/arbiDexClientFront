import type { Meta, StoryObj } from '@storybook/angular';
import { WalletConnectButtonComponent } from './wallet-connect-button.component';

const meta: Meta<WalletConnectButtonComponent> = {
  title: 'UI/WalletConnectButton',
  component: WalletConnectButtonComponent,
  tags: ['autodocs'],
  argTypes: {
    status: { control: 'select', options: ['idle','connecting','connected'] },
    clicked: { action: 'clicked' },
  },
};
export default meta;
type Story = StoryObj<WalletConnectButtonComponent>;

export const Idle: Story = {
  args: { status: 'idle', label: 'Connect Wallet' },
};
export const Connecting: Story = {
  args: { status: 'connecting', label: 'Connecting…' },
};
export const Connected: Story = {
  args: { status: 'connected', label: 'Connected' },
};

