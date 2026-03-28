import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { take } from 'rxjs/operators';
import { AuthFacade } from '../../features/auth/facades/auth.facade';
import { WalletProvider } from '../../shared/models';
import { WalletConnectButtonComponent } from '../../shared/ui/wallet-connect-button/wallet-connect-button.component';
import { WalletSelectorDialogComponent } from '../../shared/ui/wallet-selector-dialog/wallet-selector-dialog.component';
import { WalletAccountChipComponent } from '../../shared/ui/wallet-account-chip/wallet-account-chip.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatButtonModule, MatIconModule,
    WalletConnectButtonComponent, WalletAccountChipComponent,
  ],
  template: `
    <div class="login-page">
      <div class="login-card">
        <!-- Logo -->
        <div class="login-card__logo">
          <span class="login-card__logo-icon">◈</span>
          <span class="login-card__logo-name">ArbiDex</span>
        </div>
        <!-- Description -->
        <div class="login-card__desc">
          <h2 class="login-card__title">Monitor DeFi & CeFi Quotes</h2>
          <p class="login-card__subtitle">
            Real-time arbitrage monitoring across DEX and CEX exchanges.
            Connect your wallet to get started.
          </p>
        </div>
        <!-- Features -->
        <ul class="login-card__features">
          <li><span class="feature-dot"></span>Live quotes from Arbitrum, Binance, Bybit, MEXC</li>
          <li><span class="feature-dot"></span>Custom source & pair subscriptions</li>
          <li><span class="feature-dot"></span>Spread monitoring & analytics</li>
        </ul>
        <!-- Connect button / status -->
        <div class="login-card__actions">
          <app-wallet-connect-button
            *ngIf="!(isAuthenticated$ | async)"
            [status]="(isConnecting$ | async) ? 'connecting' : 'idle'"
            [label]="(isConnecting$ | async) ? 'Connecting…' : 'Connect Wallet'"
            (clicked)="openWalletSelector()" />
          <app-wallet-account-chip
            *ngIf="(isAuthenticated$ | async) && (walletAddress$ | async) as addr"
            [address]="addr"
            [provider]="(walletProvider$ | async) ?? undefined" />
        </div>
        <!-- Error -->
        <p *ngIf="authError$ | async as err" class="login-card__error">{{ err }}</p>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .login-page {
      min-height: 100vh;
      background: var(--color-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: t.$spacing-lg;
    }
    .login-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: t.$radius-lg;
      padding: t.$spacing-xxl t.$spacing-xl;
      max-width: 480px;
      width: 100%;
      box-shadow: t.$shadow-lg;
      display: flex;
      flex-direction: column;
      gap: t.$spacing-lg;
      &__logo {
        display: flex; align-items: center; gap: t.$spacing-sm;
        font-size: t.$font-size-xxl; font-weight: t.$font-weight-bold;
        color: var(--color-text-primary);
      }
      &__logo-icon { color: t.$color-primary; }
      &__title {
        margin: 0 0 t.$spacing-xs;
        font-size: t.$font-size-xl;
        font-weight: t.$font-weight-semibold;
        color: var(--color-text-primary);
      }
      &__subtitle { margin: 0; color: var(--color-text-secondary); line-height: t.$line-height-normal; }
      &__features {
        list-style: none;
        padding: 0; margin: 0;
        display: flex; flex-direction: column; gap: t.$spacing-xs;
        li {
          display: flex; align-items: center; gap: t.$spacing-sm;
          color: var(--color-text-secondary);
          font-size: t.$font-size-sm;
        }
      }
      &__actions { display: flex; flex-direction: column; gap: t.$spacing-sm; }
      &__error { color: t.$color-error; font-size: t.$font-size-sm; margin: 0; }
    }
    .feature-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: t.$color-primary; flex-shrink: 0;
    }
  `],
})
export class LoginPageComponent {
  private readonly auth = inject(AuthFacade);
  private readonly dialog = inject(MatDialog);

  readonly isAuthenticated$ = this.auth.isAuthenticated$;
  readonly isConnecting$ = this.auth.isConnecting$;
  readonly walletAddress$ = this.auth.walletAddress$;
  readonly walletProvider$ = this.auth.walletProvider$;
  readonly authError$ = this.auth.authError$;

  openWalletSelector(): void {
    const ref = this.dialog.open(WalletSelectorDialogComponent, {
      width: '420px',
      panelClass: 'wallet-dialog-panel',
    });
    ref.afterClosed().pipe(take(1)).subscribe((provider: WalletProvider | undefined) => {
      if (provider) this.auth.connect(provider);
    });
  }
}

