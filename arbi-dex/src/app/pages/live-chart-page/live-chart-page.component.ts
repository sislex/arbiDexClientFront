import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { forkJoin, Subscription as RxSubscription } from 'rxjs';
import { take, filter } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
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

/** Цвет для объединённой CEX-линии */
const MERGED_CEX_COLOR = '#ff9800';

/** Максимальное количество точек на графике */
const MAX_CHART_POINTS = 2000;

/** Ключ объединённой CEX mid-серии */
const MERGED_CEX_KEY = 'cex_avg_mid';

@Component({
  selector: 'app-live-chart-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
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
        <div class="chart-toolbar">
          <div class="live-badge">
            <span class="dot"></span> LIVE
            <span class="sub-count">{{ activeCount }} subscription{{ activeCount === 1 ? '' : 's' }}</span>
          </div>
          <mat-checkbox
            *ngIf="cexCount > 1"
            [(ngModel)]="mergeCex"
            (ngModelChange)="onMergeCexToggle()"
            color="primary">
            Merge CEX into average
          </mat-checkbox>
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

    .chart-toolbar {
      display: flex;
      align-items: center;
      gap: t.$spacing-md;
      margin-bottom: 8px;
      flex-wrap: wrap;
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

  /** Чекбокс: объединить все CEX в одну среднюю линию */
  mergeCex = false;
  /** Количество CEX-подписок (чекбокс показывается только если > 1) */
  cexCount = 0;

  /** subscriptionId → префикс ключей (для маппинга WS-сообщений) */
  private keyPrefixMap = new Map<string, string>();
  /** subscriptionId → true если это DEX-источник */
  private isDexMap = new Map<string, boolean>();
  /** subscriptionId → последние известные bid/ask (для CEX mid-вычисления) */
  private lastBidAsk = new Map<string, { bid: number; ask: number }>();
  /** Все RxJS-подписки для cleanup */
  private rxSubs: RxSubscription[] = [];

  /** Сохранённые данные для пересчёта при переключении чекбокса */
  private rawSubs: Subscription[] = [];
  private rawResults: SubscriptionPriceData[] = [];
  private rawSourceMap = new Map<string, Source>();
  private rawPairMap = new Map<string, TradingPair>();

  /** Ключи серий CEX-подписок (для фильтрации при merge) */
  private cexSeriesKeys = new Set<string>();

  ngOnInit(): void {
    this.catalogFacade.loadAll();
    this.subsFacade.load();

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

  onMergeCexToggle(): void {
    if (this.rawSubs.length > 0) {
      this.buildChart(this.rawSubs, this.rawResults, this.rawSourceMap, this.rawPairMap);
      this.cdr.markForCheck();
    }
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
          // Сохраняем для пересчёта при переключении чекбокса
          this.rawSubs = subs;
          this.rawResults = results;
          this.rawSourceMap = sourceMap;
          this.rawPairMap = pairMap;

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
    this.cexSeriesKeys.clear();

    /** Все CEX mid-ключи для вычисления среднего при merge */
    const cexMidKeys: string[] = [];
    let cexIdx = 0;

    subs.forEach((sub, idx) => {
      const data = results[idx];
      if (!data) return;

      const source = sourceMap.get(sub.sourceId);
      const pair = pairMap.get(sub.pairId);
      const label = `${source?.displayName ?? sub.sourceId} — ${pair?.displayName ?? sub.pairId}`;
      const shortId = sub.id.substring(0, 8);
      const prefix = `sub_${shortId}`;

      this.keyPrefixMap.set(sub.id, prefix);

      const isDex = source?.type === 'dex' || sub.sourceId.startsWith('dex');
      this.isDexMap.set(sub.id, isDex);

      const colorIdx = (idx * 2) % LINE_COLORS.length;

      if (!isDex) {
        cexIdx++;
      }

      data.series.forEach((origSeries, seriesIdx) => {
        const newKey = `${prefix}_${origSeries.key}`;

        if (!isDex) {
          this.cexSeriesKeys.add(newKey);
          cexMidKeys.push(newKey);
        }

        // В режиме merge CEX — не добавляем индивидуальные CEX-серии
        if (!isDex && this.mergeCex) return;

        allSeries.push({
          key: newKey,
          name: `${label} ${origSeries.name?.split(' ').pop() ?? origSeries.key}`,
          color: LINE_COLORS[(colorIdx + seriesIdx) % LINE_COLORS.length],
        });
      });

      // Записываем точки данных (всегда — нужны для вычисления среднего)
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

    this.cexCount = cexIdx;

    // Если merge включён и есть CEX — добавляем объединённую серию
    if (this.mergeCex && cexMidKeys.length > 0) {
      allSeries.push({
        key: MERGED_CEX_KEY,
        name: 'CEX Average Mid',
        color: MERGED_CEX_COLOR,
      });
    }

    this.series = allSeries;

    const sortedPoints = Array.from(timeMap.values()).sort(
      (a, b) => a.time - b.time,
    );

    let filled = this.forwardFill(sortedPoints, allSeries, cexMidKeys);

    // Если merge — вычисляем среднее CEX для каждой точки
    if (this.mergeCex && cexMidKeys.length > 0) {
      filled = filled.map((pt) => {
        let sum = 0;
        let count = 0;
        for (const k of cexMidKeys) {
          if (pt[k] !== undefined && pt[k] > 0) {
            sum += pt[k];
            count++;
          }
        }
        return {
          ...pt,
          [MERGED_CEX_KEY]: count > 0 ? sum / count : 0,
        };
      });
    }

    this.chartData = filled;
  }

  /**
   * Forward-fill: если у точки нет значения для серии,
   * берём предыдущее известное значение.
   */
  private forwardFill(
    points: PricePoint[],
    seriesConfigs: PriceSeriesConfig[],
    extraKeys: string[] = [],
  ): PricePoint[] {
    const lastKnown: Record<string, number> = {};
    // Собираем все ключи для forward-fill (серии + скрытые CEX при merge)
    const allKeys = new Set([...seriesConfigs.map((s) => s.key), ...extraKeys]);

    return points.map((pt) => {
      const filled: PricePoint = { time: pt.time };
      allKeys.forEach((key) => {
        if (pt[key] !== undefined) {
          filled[key] = pt[key];
          lastKnown[key] = pt[key];
        } else if (lastKnown[key] !== undefined) {
          filled[key] = lastKnown[key];
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

    const isDex = this.isDexMap.get(msg.subscriptionId) ?? false;
    const fieldKey = msg.key.split('|').pop() ?? msg.key;

    const keyLower = fieldKey.toLowerCase();
    const isBid = keyLower.includes('bid');
    const isAsk = keyLower.includes('ask');

    const last = this.chartData[this.chartData.length - 1];

    let newPoint: PricePoint;

    if (isDex) {
      // DEX: передаём bid/ask как есть
      const newFieldKey = `${prefix}_${fieldKey}`;
      newPoint = {
        ...(last ?? {}),
        time: msg.point.t,
        [newFieldKey]: msg.point.v,
      };
    } else {
      // CEX: вычисляем mid из bid/ask
      let ba = this.lastBidAsk.get(msg.subscriptionId);
      if (!ba) {
        ba = { bid: 0, ask: 0 };
        this.lastBidAsk.set(msg.subscriptionId, ba);
      }
      if (isBid) ba.bid = msg.point.v;
      if (isAsk) ba.ask = msg.point.v;

      const mid = ba.bid > 0 && ba.ask > 0
        ? (ba.bid + ba.ask) / 2
        : ba.bid || ba.ask;
      if (mid <= 0) return;

      const midFieldKey = `${prefix}_midPrice`;
      newPoint = {
        ...(last ?? {}),
        time: msg.point.t,
        [midFieldKey]: mid,
      };

      // Если merge включён — пересчитываем среднее CEX
      if (this.mergeCex) {
        let sum = 0;
        let count = 0;
        for (const k of this.cexSeriesKeys) {
          const val = newPoint[k];
          if (val !== undefined && val > 0) {
            sum += val;
            count++;
          }
        }
        if (count > 0) {
          newPoint[MERGED_CEX_KEY] = sum / count;
        }
      }
    }

    let updated = [...this.chartData, newPoint];
    if (updated.length > MAX_CHART_POINTS) {
      updated = updated.slice(updated.length - MAX_CHART_POINTS);
    }
    this.chartData = updated;
    this.cdr.markForCheck();
  }
}
