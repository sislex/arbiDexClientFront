import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { take } from 'rxjs/operators';
import { AuthFacade } from '../../features/auth/facades/auth.facade';
import { LayoutFacade } from '../../features/layout/facades/layout.facade';
import { WalletAccountChipComponent } from '../../shared/ui/wallet-account-chip/wallet-account-chip.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatToolbarModule, MatButtonModule,
    MatIconModule, MatMenuModule, MatTooltipModule, WalletAccountChipComponent,
  ],
  template: `
    <mat-toolbar class="header">
      <button mat-icon-button (click)="menuToggle.emit()" class="header__burger">
        <mat-icon>{{ sidebarOpened ? 'menu_open' : 'menu' }}</mat-icon>
      </button>
      <span class="header__logo">
        <span class="header__logo-icon">◈</span>
        ArbiDex
      </span>
      <span class="flex-1"></span>
      <button mat-icon-button
        (click)="toggleTheme()"
        [matTooltip]="(theme$ | async) === 'dark' ? 'Switch to Light' : 'Switch to Dark'">
        <mat-icon>{{ (theme$ | async) === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>
      <app-wallet-account-chip
        *ngIf="walletAddress$ | async as addr"
        [address]="addr"
        [provider]="(provider$ | async) ?? undefined" />
    </mat-toolbar>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .header {
      height: t.$header-height;
      padding: 0 t.$spacing-md;
      gap: t.$spacing-sm;
      position: sticky; top: 0;
      z-index: t.$z-header;
      &__burger { flex-shrink: 0; }
      &__logo {
        display: flex; align-items: center; gap: t.$spacing-xs;
        font-size: t.$font-size-lg;
        font-weight: t.$font-weight-bold;
        color: var(--color-text-primary);
        letter-spacing: -0.5px;
      }
      &__logo-icon { color: t.$color-primary; font-size: 20px; }
    }
  `],
})
export class HeaderComponent {
  @Input() sidebarOpened = true;
  @Output() menuToggle = new EventEmitter<void>();

  private readonly auth = inject(AuthFacade);
  readonly layout = inject(LayoutFacade);

  readonly walletAddress$ = this.auth.walletAddress$;
  readonly provider$ = this.auth.walletProvider$;
  readonly theme$ = this.layout.theme$;

  toggleTheme(): void {
    this.layout.theme$.pipe(take(1)).subscribe((current) => {
      this.layout.setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
}
