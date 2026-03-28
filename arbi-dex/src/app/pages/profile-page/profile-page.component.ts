import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthFacade } from '../../features/auth/facades/auth.facade';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ContentCardComponent } from '../../shared/ui/content-card/content-card.component';
import { WalletAccountChipComponent } from '../../shared/ui/wallet-account-chip/wallet-account-chip.component';
import { SourceBadgeComponent } from '../../shared/ui/source-badge/source-badge.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatIconModule,
    PageContainerComponent, PageHeaderComponent, ContentCardComponent,
    WalletAccountChipComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header title="Profile" subtitle="Your wallet and account settings" />

      <app-content-card title="Wallet" style="max-width:480px">
        <div class="profile-row">
          <span class="profile-label">Address</span>
          <app-wallet-account-chip
            *ngIf="walletAddress$ | async as addr"
            [address]="addr"
            [provider]="(walletProvider$ | async) ?? undefined" />
        </div>
        <div class="profile-row">
          <span class="profile-label">Provider</span>
          <span class="profile-value">{{ (walletProvider$ | async) ?? '—' }}</span>
        </div>
        <div class="profile-row">
          <span class="profile-label">Status</span>
          <span class="profile-status">● Connected</span>
        </div>
        <div class="profile-actions">
          <button mat-stroked-button color="warn" (click)="logout()">
            <mat-icon>logout</mat-icon> Disconnect Wallet
          </button>
        </div>
      </app-content-card>
    </app-page-container>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .profile-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: t.$spacing-md 0;
      border-bottom: 1px solid var(--color-border);
      &:last-of-type { border-bottom: none; }
    }
    .profile-label {
      font-size: t.$font-size-sm;
      color: var(--color-text-secondary);
      font-weight: t.$font-weight-medium;
    }
    .profile-value { font-size: t.$font-size-base; color: var(--color-text-primary); }
    .profile-status { font-size: t.$font-size-sm; color: t.$color-success; font-weight: t.$font-weight-medium; }
    .profile-actions { margin-top: t.$spacing-lg; }
  `],
})
export class ProfilePageComponent {
  private readonly auth = inject(AuthFacade);
  readonly walletAddress$ = this.auth.walletAddress$;
  readonly walletProvider$ = this.auth.walletProvider$;

  logout(): void { this.auth.logout(); }
}

