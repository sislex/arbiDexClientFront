import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     icon: 'dashboard',     route: '/dashboard' },
  { label: 'Market Catalog',icon: 'explore',       route: '/market' },
  { label: 'Subscriptions', icon: 'bookmark',      route: '/subscriptions' },
  { label: 'Arbi Configs',  icon: 'tune',          route: '/arbi-configs' },
  { label: 'Live Chart',    icon: 'show_chart',    route: '/live-chart' },
  { label: 'Demo Account',  icon: 'account_balance_wallet', route: '/demo-account' },
  { label: 'Profile',       icon: 'account_circle',route: '/profile' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatListModule, MatIconModule],
  template: `
    <nav class="sidebar">
      <div class="sidebar__brand">
        <span class="sidebar__brand-icon">◈</span>
        <span class="sidebar__brand-name">ArbiDex</span>
      </div>
      <mat-nav-list class="sidebar__nav">
        <a
          *ngFor="let item of navItems"
          mat-list-item
          [routerLink]="item.route"
          routerLinkActive="sidebar__item--active"
          class="sidebar__item">
          <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
          <span matListItemTitle>{{ item.label }}</span>
        </a>
      </mat-nav-list>
    </nav>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .sidebar {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--color-surface);
      &__brand {
        display: flex;
        align-items: center;
        gap: t.$spacing-sm;
        padding: t.$spacing-lg t.$spacing-md;
        border-bottom: 1px solid var(--color-border);
        font-size: t.$font-size-md;
        font-weight: t.$font-weight-bold;
        color: var(--color-text-primary);
      }
      &__brand-icon { color: t.$color-primary; font-size: 20px; }
      &__nav { padding-top: t.$spacing-sm; }
      &__item {
        border-radius: t.$radius-sm !important;
        margin: 2px t.$spacing-xs !important;
        transition: background t.$transition-fast;
        &--active {
          background: t.$color-info-light !important;
          color: t.$color-primary !important;
          mat-icon { color: t.$color-primary; }
        }
      }
    }
  `],
})
export class SidebarComponent {
  readonly navItems = NAV_ITEMS;
}

