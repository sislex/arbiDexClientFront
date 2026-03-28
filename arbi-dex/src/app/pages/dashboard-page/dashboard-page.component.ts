import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { combineLatest, map } from 'rxjs';
import { AuthFacade } from '../../features/auth/facades/auth.facade';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import { SubscriptionsFacade } from '../../features/subscriptions/facades/subscriptions.facade';
import { QuotesFacade } from '../../features/quotes/facades/quotes.facade';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { PageSectionComponent } from '../../shared/ui/page-section/page-section.component';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { QuotesTableComponent } from '../../shared/ui/quotes-table/quotes-table.component';
import { ContentCardComponent } from '../../shared/ui/content-card/content-card.component';
import { SourceBadgeComponent } from '../../shared/ui/source-badge/source-badge.component';
import { PairBadgeComponent } from '../../shared/ui/pair-badge/pair-badge.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatButtonModule, MatIconModule,
    PageContainerComponent, PageHeaderComponent, PageSectionComponent,
    StatCardComponent, QuotesTableComponent, ContentCardComponent,
    SourceBadgeComponent, PairBadgeComponent, StatusBadgeComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        title="Dashboard"
        [subtitle]="'Welcome back, ' + ((walletAddress$ | async) || 'Trader')">
        <div slot="actions">
          <button mat-stroked-button routerLink="/market">
            <mat-icon>explore</mat-icon> Market Catalog
          </button>
          <button mat-stroked-button routerLink="/subscriptions" style="margin-left:8px">
            <mat-icon>bookmark</mat-icon> Subscriptions
          </button>
        </div>
      </app-page-header>

      <!-- Stats -->
      <app-page-section>
        <div class="stats-grid">
          <app-stat-card label="Sources"       [value]="(sourcesCount$ | async) ?? 0" icon="hub"            color="blue" />
          <app-stat-card label="Pairs"          [value]="(pairsCount$ | async) ?? 0"   icon="swap_horiz"     color="purple" />
          <app-stat-card label="Subscriptions" [value]="(subsCount$ | async) ?? 0"    icon="bookmark"       color="green" />
          <app-stat-card label="Quotes"         [value]="(quotesCount$ | async) ?? 0"  icon="show_chart"     color="orange"
            [loading]="(quotesLoading$ | async) ?? false" />
        </div>
      </app-page-section>

      <!-- Active subscriptions -->
      <app-page-section title="Active Subscriptions">
        <div *ngIf="(activeSubs$ | async)?.length; else noSubs" class="subs-chips">
          <div *ngFor="let sub of (activeSubs$ | async)?.slice(0, 6)" class="sub-chip">
            <app-source-badge
              *ngIf="sourceById(sub.sourceId) as src"
              [type]="src.type"
              [displayName]="src.displayName" />
            <app-pair-badge
              *ngIf="pairById(sub.pairId) as pr"
              [base]="pr.base"
              [quote]="pr.quote" />
            <app-status-badge [status]="sub.enabled ? 'active' : 'inactive'" />
          </div>
        </div>
        <ng-template #noSubs>
          <p class="text-muted">No active subscriptions. <a routerLink="/market">Add some →</a></p>
        </ng-template>
      </app-page-section>

      <!-- Latest quotes table -->
      <app-page-section title="Latest Quotes">
        <app-content-card>
          <app-quotes-table
            [quotes]="(latestQuotes$ | async) ?? []"
            [sources]="(sources$ | async) ?? []"
            [pairs]="(pairs$ | async) ?? []"
            [loading]="(quotesLoading$ | async) ?? false" />
        </app-content-card>
      </app-page-section>
    </app-page-container>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: t.$spacing-md;
      @media (max-width: #{t.$bp-md}) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: #{t.$bp-sm}) { grid-template-columns: 1fr; }
    }
    .subs-chips { display: flex; flex-wrap: wrap; gap: t.$spacing-sm; }
    .sub-chip {
      display: flex; align-items: center; gap: t.$spacing-xs;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: t.$radius-sm;
      padding: t.$spacing-xs t.$spacing-sm;
    }
  `],
})
export class DashboardPageComponent implements OnInit {
  private readonly auth = inject(AuthFacade);
  private readonly catalog = inject(CatalogFacade);
  private readonly subs = inject(SubscriptionsFacade);
  private readonly quotes = inject(QuotesFacade);

  readonly walletAddress$ = this.auth.walletAddress$;
  readonly sources$ = this.catalog.sources$;
  readonly pairs$ = this.catalog.pairs$;
  readonly sourcesCount$ = this.sources$.pipe(map((s) => s.length));
  readonly pairsCount$ = this.pairs$.pipe(map((p) => p.length));
  readonly subsCount$ = this.subs.count$;
  readonly activeSubs$ = this.subs.active$;
  readonly latestQuotes$ = this.quotes.latestQuotes$;
  readonly quotesCount$ = this.quotes.count$;
  readonly quotesLoading$ = this.quotes.loading$;

  ngOnInit(): void {
    this.catalog.loadAll();
    this.subs.load();
    this.quotes.loadLatest();
  }

  sourceById(id: string) {
    let result: any;
    this.sources$.pipe(map((s) => s.find((x) => x.id === id))).subscribe((v) => (result = v)).unsubscribe();
    return result;
  }

  pairById(id: string) {
    let result: any;
    this.pairs$.pipe(map((p) => p.find((x) => x.id === id))).subscribe((v) => (result = v)).unsubscribe();
    return result;
  }
}

