import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { LayoutFacade } from '../../features/layout/facades/layout.facade';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, MatSidenavModule, HeaderComponent, SidebarComponent],
  template: `
    <div class="shell" [attr.data-theme]="(theme$ | async)">
      <app-header
        [sidebarOpened]="(sidebarOpened$ | async) ?? true"
        (menuToggle)="layout.toggleSidebar()" />
      <mat-sidenav-container class="shell__container">
        <mat-sidenav
          class="shell__sidenav"
          [mode]="(isMobile$ | async) ? 'over' : 'side'"
          [opened]="(sidebarOpened$ | async) ?? true"
          (openedChange)="layout.setSidebarOpen($event)">
          <app-sidebar />
        </mat-sidenav>
        <mat-sidenav-content class="shell__content">
          <main class="shell__main">
            <router-outlet />
          </main>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    :host { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--color-bg);
      &__container { flex: 1; overflow: hidden; }
      &__sidenav {
        width: t.$sidebar-width;
        border-right: 1px solid var(--color-border);
        background: var(--color-surface);
      }
      &__content { background: var(--color-bg); }
      &__main {
        height: 100%;
        overflow-y: auto;
        padding: t.$spacing-lg;
      }
    }
    @media (max-width: #{t.$bp-sm}) {
      .shell__main { padding: t.$spacing-md; }
    }
  `],
})
export class AppShellComponent implements OnInit {
  readonly layout = inject(LayoutFacade);
  readonly sidebarOpened$ = this.layout.sidebarOpened$;
  readonly theme$ = this.layout.theme$;

  readonly isMobile$ = inject(BreakpointObserver)
    .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
    .pipe(map((r) => r.matches));

  ngOnInit(): void {
    // Close sidebar by default on mobile
    this.isMobile$.subscribe((isMobile) => {
      if (isMobile) this.layout.setSidebarOpen(false);
    });
  }
}

