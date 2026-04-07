import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { forkJoin, Subscription as RxSubscription } from 'rxjs';
import { take, filter } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  PriceChartComponent,
  PriceSeriesConfig,
  PricePoint,
} from '../../shared/ui/price-chart/price-chart.component';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { API_BASE_URL } from '../../core/config/api.config';
import { selectAccessToken } from '../../features/auth/store/auth.selectors';
import {
  LiveChartSocketService,
  MultiLiveChartMessage,
} from '../../features/live-chart/services/live-chart-socket.service';
import { SubscriptionsFacade } from '../../features/subscriptions/facades/subscriptions.facade';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import { SubscriptionPriceData } from '../../features/subscriptions/services/prices.service.interface';
import { Subscription, Source, TradingPair } from '../../shared/models';

/** Палитра цветов для линий графика */
const LINE_COLORS = [
  '#0ecb81', '#f6465d',
  '#2196f3', '#ff9800',
  '#ab47bc', '#ffeb3b',
  '#00bcd4', '#e91e63',
  '#8bc34a', '#ff5722',
  '#3f51b5', '#cddc39',
];

/** Максимальное количество точек на графике */
const MAX_CHART_POINTS = 2000;

@Component({
  selector: 'app-live-chart-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    PriceChartComponent,
    PageContainerComponent,
    PageHeaderComponent,
    LoadingStateComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        title="Live Chart"
        subtitle="Real-time price updates for all active subscriptions">
      </app-page-header>

      <app-loading-state *ngIf="loading" label="Loading chart data…" />

      <app-empty-state
        *ngIf="!loading && noSubscriptions"
        icon="show_chart"
        title="No active subscriptions"
        description="Add subscriptions in the Market Catalog and enable them to see live chart."
        actionLabel="Go to Market"
        (action)="goToMarket()">
      </app-empty-state>

      <div *ngIf="error" class="error-msg">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error }}</span>
      </div>

      <div *ngIf="!loading && !error && !noSubscriptions" class="chart-wrapper">
        <div class="live-badge">
          <span class="dot"></span> LIVE
          <span class="sub-count">{{ activeCount }} subscription{{ activeCount === 1 ? '' : 's' }}</span>
        </div>
        <app-price-chart
          [series]="series"
          [data]="chartData"
          [streaming]="false" />
      </div>
    </app-page-container>
  `,
  styles: [`
    @use 'styles/tokens' as t;

    .error-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: var(--color-danger, #ef4444);
      justify-content: center;
    }

    .chart-wrapper {
      position: relative;
    }

    .live-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(14, 203, 129, 0.15);
      border: 1px solid #0ecb81;
      border-radius: 4px;
      color: #0ecb81;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
      letter-spacing: 1px;

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #0ecb81;
        animation: pulse 1.5s ease-in-out infinite;
      }

      .sub-count {
        margin-left: 8px;
        color: var(--color-text-muted, #848e9c);
        font-weight: 400;
        letter-spacing: 0;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
    }
  `],
})
export class LiveChartPageComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly liveChartSocket = inject(LiveChartSocketService);
  private readonly subsFacade = inject(SubscriptionsFacade);
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly cdr = inject(ChangeDetectorRef);

  series: PriceSeriesConfig[] = [];
  chartData: PricePoint[] = [];
  loading = true;
  error = '';
  noSubscriptions = false;
  activeCount = 0;

  /** subscriptionId → префикс ключей (для маппинга WS-сообщений) */
  private keyPrefixMap = new Map<string, string>();
  /** Все RxJS-подписки для cleanup */
  private rxSubs: RxSubscription[] = [];

  ngOnInit(): void {
    this.catalogFacade.loadAll();
    this.subsFacade.load();

    // Ждём пока подписки загрузятся, потом строим чарт
    const sub = this.subsFacade.loading$.pipe(
      filter((loading) => !loading),
      take(1),
    ).subscribe(() => this.onSubscriptionsLoaded());
    this.rxSubs.push(sub);
  }

  ngOnDestroy(): void {
    this.rxSubs.forEach((s) => s.unsubscribe());
    this.liveChartSocket.disconnectAll();
  }

  goToMarket(): void {
    this.router.navigate(['/market']);
  }

  /* ── Загрузка данных ── */

  private onSubscriptionsLoaded(): void {
    const sub = this.subsFacade.active$.pipe(take(1)).subscribe((activeSubs) => {
      if (activeSubs.length === 0) {
        this.loading = false;
        this.noSubscriptions = true;
        this.cdr.markForCheck();
        return;
      }
      this.activeCount = activeSubs.length;
      this.loadChartData(activeSubs);
    });
    this.rxSubs.push(sub);
  }

  private loadChartData(subs: Subscription[]): void {
    const catalogSub = forkJoin([
      this.catalogFacade.sources$.pipe(take(1)),
      this.catalogFacade.pairs$.pipe(take(1)),
    ]).subscribe(([sources, pairs]) => {
      const sourceMap = new Map(sources.map((s: Source) => [s.id, s]));
      const pairMap = new Map(pairs.map((p: TradingPair) => [p.id, p]));

      const requests = subs.map((s) =>
        this.http.get<SubscriptionPriceData>(
          `${this.apiUrl}/prices/subscription/${s.id}`,
        ),
      );

      forkJoin(requests).subscribe({
        next: (results) => {
          this.buildChart(subs, results, sourceMap, pairMap);
          this.loading = false;
          this.cdr.markForCheck();
          this.connectSockets(subs.map((s) => s.id));
        },
        error: () => {
          this.loading = false;
          this.error = 'Не удалось загрузить исторические данные';
          this.cdr.markForCheck();
        },
      });
    });
    this.rxSubs.push(catalogSub);
  }

  /* ── Построение объединённого чарта ── */

  private buildChart(
    subs: Subscription[],
    results: SubscriptionPriceData[],
    sourceMap: Map<string, Source>,
    pairMap: Map<string, TradingPair>,
  ): void {
    const allSeries: PriceSeriesConfig[] = [];
    const timeMap = new Map<number, PricePoint>();

    subs.forEach((sub, idx) => {
      const data = results[idx];
      if (!data) return;

      const source = sourceMap.get(sub.sourceId);
      const pair = pairMap.get(sub.pairId);
      const label = `${source?.displayName ?? sub.sourceId} — ${pair?.displayName ?? sub.pairId}`;
      const shortId = sub.id.substring(0, 8);
      const prefix = `sub_${shortId}`;

      this.keyPrefixMap.set(sub.id, prefix);

      const colorIdx = (idx * 2) % LINE_COLORS.length;

      data.series.forEach((origSeries, seriesIdx) => {
        const newKey = `${prefix}_${origSeries.key}`;
        const isBid = origSeries.key.toLowerCase().includes('bid');
        allSeries.push({
          key: newKey,
          name: `${label} ${isBid ? 'Bid' : 'Ask'}`,
          color: LINE_COLORS[(colorIdx + seriesIdx) % LINE_COLORS.length],
        });
      });

      data.data.forEach((point) => {
        const existing = timeMap.get(point.time) ?? { time: point.time };
        data.series.forEach((origSeries) => {
          const newKey = `${prefix}_${origSeries.key}`;
          if (point[origSeries.key] !== undefined) {
            existing[newKey] = point[origSeries.key];
          }
        });
        timeMap.set(point.time, existing);
      });
    });

    this.series = allSeries;

    const sortedPoints = Array.from(timeMap.values()).sort(
      (a, b) => a.time - b.time,
    );
    this.chartData = this.forwardFill(sortedPoints, allSeries);
  }

  /**
   * Forward-fill: если у точки нет значения для серии,
   * берём предыдущее известное значение.
   */
  private forwardFill(
    points: PricePoint[],
    seriesConfigs: PriceSeriesConfig[],
  ): PricePoint[] {
    const lastKnown: Record<string, number> = {};

    return points.map((pt) => {
      const filled: PricePoint = { time: pt.time };
      seriesConfigs.forEach((s) => {
        if (pt[s.key] !== undefined) {
          filled[s.key] = pt[s.key];
          lastKnown[s.key] = pt[s.key];
        } else if (lastKnown[s.key] !== undefined) {
          filled[s.key] = lastKnown[s.key];
        }
      });
      return filled;
    });
  }

  /* ── WebSocket ── */

  private connectSockets(subscriptionIds: string[]): void {
    this.store
      .select(selectAccessToken)
      .pipe(take(1))
      .subscribe((token) => {
        if (!token) return;

        const wsSub = this.liveChartSocket
          .connectMultiple(token, subscriptionIds)
          .subscribe({
            next: (msg) => this.onPriceUpdate(msg),
            error: (err) => console.error('LiveChart WebSocket error:', err),
          });
        this.rxSubs.push(wsSub);
      });
  }

  private onPriceUpdate(msg: MultiLiveChartMessage): void {
    const prefix = this.keyPrefixMap.get(msg.subscriptionId);
    if (!prefix) return;

    const fieldKey = msg.key.split('|').pop() ?? msg.key;
    const newFieldKey = `${prefix}_${fieldKey}`;

    const last = this.chartData[this.chartData.length - 1];
    const newPoint: PricePoint = {
      ...(last ?? {}),
      time: msg.point.t,
      [newFieldKey]: msg.point.v,
    };

    let updated = [...this.chartData, newPoint];
    if (updated.length > MAX_CHART_POINTS) {
      updated = updated.slice(updated.length - MAX_CHART_POINTS);
    }
    this.chartData = updated;
    this.cdr.markForCheck();
  }
}
