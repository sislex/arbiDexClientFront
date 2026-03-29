import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { map, combineLatest, BehaviorSubject } from 'rxjs';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { PageSectionComponent } from '../../shared/ui/page-section/page-section.component';
import { PriceChartComponent, PricePoint, PriceSeriesConfig } from '../../shared/ui/price-chart/price-chart.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SubscriptionsFacade } from '../../features/subscriptions/facades/subscriptions.facade';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import { IPricesService } from '../../features/subscriptions/services/prices.service.interface';

@Component({
  selector: 'app-subscription-detail-page',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatButtonModule, MatIconModule,
    PageContainerComponent, PageHeaderComponent, PageSectionComponent,
    PriceChartComponent, LoadingStateComponent, EmptyStateComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        [title]="(title$ | async) ?? 'Subscription'"
        subtitle="Price chart for selected subscription">
        <div slot="actions">
          <button mat-stroked-button routerLink="/subscriptions">
            <mat-icon>arrow_back</mat-icon> Back
          </button>
        </div>
      </app-page-header>

      <app-page-section>
        <app-loading-state *ngIf="loading$ | async" label="Loading price data…" />
        <app-empty-state
          *ngIf="(loading$ | async) === false && (chartData$ | async)?.length === 0"
          icon="show_chart"
          title="No price data"
          description="Price data is not available for this subscription yet. Make sure arbiDexServerBots is running." />
        <div class="chart-wrap" *ngIf="(loading$ | async) === false && ((chartData$ | async)?.length ?? 0) > 0">
          <app-price-chart
            [data]="(chartData$ | async) ?? []"
            [series]="(chartSeries$ | async) ?? []"
            [streaming]="false" />
        </div>
        <div class="error-msg" *ngIf="error$ | async as error">{{ error }}</div>
      </app-page-section>
    </app-page-container>
  `,
  styles: [`
    .chart-wrap {
      width: 100%;
      height: 540px;
      border-radius: 8px;
      overflow: hidden;
    }
    .error-msg {
      color: #ef4444;
      padding: 16px;
      text-align: center;
    }
  `],
})
export class SubscriptionDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly subs = inject(SubscriptionsFacade);
  private readonly catalog = inject(CatalogFacade);
  private readonly pricesService = inject(IPricesService);

  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly chartData$ = new BehaviorSubject<PricePoint[]>([]);
  readonly chartSeries$ = new BehaviorSubject<PriceSeriesConfig[]>([]);
  readonly error$ = new BehaviorSubject<string | null>(null);

  readonly title$ = combineLatest([
    this.subs.saved$,
    this.catalog.sources$,
    this.catalog.pairs$,
  ]).pipe(
    map(([subscriptions, sources, pairs]) => {
      const id = this.route.snapshot.paramMap.get('id');
      const sub = subscriptions.find((s) => s.id === id);
      if (!sub) return 'Subscription';
      const source = sources.find((s) => s.id === sub.sourceId)?.displayName ?? sub.sourceId;
      const pair = pairs.find((p) => p.id === sub.pairId)?.displayName ?? sub.pairId;
      return `${source} — ${pair}`;
    }),
  );

  ngOnInit(): void {
    this.subs.load();
    this.catalog.loadAll();
    this.loadPrices();
  }

  private loadPrices(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.loading$.next(true);
    this.error$.next(null);

    this.pricesService.getPricesBySubscription(id).subscribe({
      next: (result) => {
        this.chartSeries$.next(result.series);
        this.chartData$.next(result.data);
        this.loading$.next(false);
      },
      error: (err) => {
        this.error$.next(err?.error?.message ?? 'Failed to load price data');
        this.loading$.next(false);
      },
    });
  }
}
