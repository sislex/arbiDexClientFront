import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { WalletProvider } from '../../models';

export interface WalletOption {
  provider: WalletProvider;
  name: string;
  icon: string;
  description: string;
}

const WALLET_OPTIONS: WalletOption[] = [
  { provider: WalletProvider.MetaMask,      name: 'MetaMask',       icon: 'account_balance_wallet', description: 'Browser extension wallet' },
  { provider: WalletProvider.WalletConnect, name: 'WalletConnect',  icon: 'qr_code_scanner',        description: 'Scan with mobile wallet' },
  { provider: WalletProvider.CoinbaseWallet,name: 'Coinbase Wallet',icon: 'currency_bitcoin',        description: 'Coinbase self-custody wallet' },
];

@Component({
  selector: 'app-wallet-selector-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="wallet-dialog">
      <h2 mat-dialog-title class="wallet-dialog__title">Connect Wallet</h2>
      <mat-dialog-content>
        <p class="wallet-dialog__subtitle">Select your preferred wallet provider</p>
        <div class="wallet-dialog__options">
          <button
            *ngFor="let opt of options"
            class="wallet-option"
            (click)="select(opt.provider)">
            <mat-icon class="wallet-option__icon">{{ opt.icon }}</mat-icon>
            <div class="wallet-option__text">
              <span class="wallet-option__name">{{ opt.name }}</span>
              <span class="wallet-option__desc">{{ opt.description }}</span>
            </div>
            <mat-icon class="wallet-option__arrow">chevron_right</mat-icon>
          </button>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .wallet-dialog {
      min-width: 360px;
      &__title { font-weight: t.$font-weight-semibold; margin-bottom: 0; }
      &__subtitle { color: var(--color-text-secondary); font-size: t.$font-size-sm; margin-bottom: t.$spacing-md; }
      &__options { display: flex; flex-direction: column; gap: t.$spacing-xs; }
    }
    .wallet-option {
      display: flex;
      align-items: center;
      gap: t.$spacing-md;
      padding: t.$spacing-md;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: t.$radius-sm;
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: all t.$transition-fast;
      &:hover { border-color: t.$color-primary; background: t.$color-info-light; }
      &__icon { color: t.$color-primary; }
      &__text { flex: 1; display: flex; flex-direction: column; }
      &__name { font-weight: t.$font-weight-semibold; font-size: t.$font-size-base; color: var(--color-text-primary); }
      &__desc { font-size: t.$font-size-xs; color: var(--color-text-secondary); }
      &__arrow { color: var(--color-text-muted); }
    }
  `],
})
export class WalletSelectorDialogComponent {
  readonly options = WALLET_OPTIONS;

  constructor(private dialogRef: MatDialogRef<WalletSelectorDialogComponent>) {}

  select(provider: WalletProvider): void {
    this.dialogRef.close(provider);
  }
}

