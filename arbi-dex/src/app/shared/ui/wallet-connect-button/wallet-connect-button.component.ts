import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type WalletConnectStatus = 'idle' | 'connecting' | 'connected';

@Component({
  selector: 'app-wallet-connect-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <button
      mat-flat-button
      class="wallet-connect-btn"
      [class.wallet-connect-btn--connected]="status === 'connected'"
      [disabled]="status === 'connecting'"
      (click)="clicked.emit()">
      <mat-spinner *ngIf="status === 'connecting'; else iconTpl" diameter="18" class="btn-spinner" />
      <ng-template #iconTpl>
        <mat-icon>account_balance_wallet</mat-icon>
      </ng-template>
      <span>{{ label }}</span>
    </button>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .wallet-connect-btn {
      display: flex;
      align-items: center;
      gap: t.$spacing-xs;
      padding: 0 t.$spacing-lg;
      height: 48px;
      font-size: t.$font-size-base;
      font-weight: t.$font-weight-semibold;
      background: t.$color-primary;
      color: #fff;
      border-radius: t.$radius-sm;
      transition: background t.$transition-fast;
      &:hover:not([disabled]) { background: t.$color-primary-dark; }
      &--connected { background: t.$color-success; }
      .btn-spinner { display: flex; align-items: center; }
    }
  `],
})
export class WalletConnectButtonComponent {
  @Input() status: WalletConnectStatus = 'idle';
  @Input() label = 'Connect Wallet';
  @Output() clicked = new EventEmitter<void>();
}

