import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ShortAddressPipe } from '../../pipes/short-address.pipe';

@Component({
  selector: 'app-wallet-account-chip',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, ShortAddressPipe],
  template: `
    <div class="wallet-chip" [matTooltip]="address">
      <mat-icon class="wallet-chip__icon">account_balance_wallet</mat-icon>
      <span class="wallet-chip__address">{{ address | shortAddress }}</span>
      <span *ngIf="provider" class="wallet-chip__provider">{{ provider }}</span>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .wallet-chip {
      display: inline-flex;
      align-items: center;
      gap: t.$spacing-xs;
      padding: t.$spacing-xs t.$spacing-sm;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: t.$radius-full;
      cursor: default;
      &__icon { font-size: 16px; width: 16px; height: 16px; color: t.$color-success; }
      &__address {
        font-size: t.$font-size-sm;
        font-weight: t.$font-weight-medium;
        font-family: monospace;
        color: var(--color-text-primary);
      }
      &__provider {
        font-size: t.$font-size-xs;
        color: var(--color-text-muted);
        border-left: 1px solid var(--color-border);
        padding-left: t.$spacing-xs;
      }
    }
  `],
})
export class WalletAccountChipComponent {
  @Input({ required: true }) address!: string;
  @Input() provider?: string;
}

