import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { map, combineLatest } from 'rxjs';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { PageSectionComponent } from '../../shared/ui/page-section/page-section.component';
import { PriceChartComponent } from '../../shared/ui/price-chart/price-chart.component';
import { SubscriptionsFacade } from '../../features/subscriptions/facades/subscriptions.facade';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import { priceChartStubs_medium, twoLineSeries } from '../../shared/ui/price-chart/price-chart.stubs';

@Component({
  selector: 'app-subscription-detail-page',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatButtonModule, MatIconModule,
    PageContainerComponent, PageHeaderComponent, PageSectionComponent,
    PriceChartComponent,
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
        <div class="chart-wrap">
          <app-price-chart
            [data]="chartData"
            [series]="chartSeries"
            [streaming]="false" />
        </div>
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
  `],
})
export class SubscriptionDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly subs = inject(SubscriptionsFacade);
  private readonly catalog = inject(CatalogFacade);

  /** Стабленные данные для графика */
  readonly chartData = priceChartStubs_medium;
  readonly chartSeries = twoLineSeries;

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
  }
}



