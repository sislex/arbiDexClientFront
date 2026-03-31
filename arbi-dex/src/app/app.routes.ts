import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login-page/login-page.component').then(
        (m) => m.LoginPageComponent,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./shell/app-shell/app-shell.component').then(
        (m) => m.AppShellComponent,
      ),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard-page/dashboard-page.component').then(
            (m) => m.DashboardPageComponent,
          ),
      },
      {
        path: 'market',
        loadComponent: () =>
          import('./pages/market-page/market-page.component').then(
            (m) => m.MarketPageComponent,
          ),
      },
      {
        path: 'subscriptions',
        loadComponent: () =>
          import('./pages/subscriptions-page/subscriptions-page.component').then(
            (m) => m.SubscriptionsPageComponent,
          ),
      },
      {
        path: 'subscriptions/liveChart/:id',
        loadComponent: () =>
          import('./pages/live-chart-page/live-chart-page.component').then(
            (m) => m.LiveChartPageComponent,
          ),
      },
      {
        path: 'subscriptions/:id',
        loadComponent: () =>
          import('./pages/subscription-detail-page/subscription-detail-page.component').then(
            (m) => m.SubscriptionDetailPageComponent,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile-page/profile-page.component').then(
            (m) => m.ProfilePageComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
