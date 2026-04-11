import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription as RxSubscription, combineLatest } from 'rxjs';
import { take, filter } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import {
  PriceChartComponent,
  PriceSeriesConfig,
  PricePoint,
} from '../../shared/ui/price-chart/price-chart.component';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ContentCardComponent } from '../../shared/ui/content-card/content-card.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state/loading-state.component';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { ArbiConfigsFacade } from '../../features/arbi-configs/facades/arbi-configs.facade';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import {
  LiveChartSocketService,
  MultiLiveChartMessage,
} from '../../features/live-chart/services/live-chart-socket.service';
import { selectAccessToken } from '../../features/auth/store/auth.selectors';
import {
  buildMultiChart,
  extractFieldKey,
  ChartSubscriptionInfo,
  MultiChartResult,
} from '../../shared/utils/multi-chart-builder';
import { ArbiConfig, Source, TradingPair } from '../../shared/models';

const MAX_CHART_POINTS = 2000;

@Component({
  selector: 'app-arbi-config-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatChipsModule,
    PriceChartComponent,
    PageContainerComponent,
    PageHeaderComponent,
    ContentCardComponent,
    LoadingStateComponent,
    StatCardComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        [title]="config?.name ?? 'Config'"
        subtitle="Arbitrage config detail with price chart">
        <div slot="actions" class="header-actions">
          <mat-button-toggle-group
            [value]="mode"
            (change)="onModeChange($event.value)"
            appearance="standard"
            class="mode-toggle">
            <mat-button-toggle value="historical">
              <mat-icon>history</mat-icon> Historical
            </mat-button-toggle>
            <mat-button-toggle value="live">
              <mat-icon>wifi</mat-icon> Live
            </mat-button-toggle>
          </mat-button-toggle-group>

          <button mat-stroked-button [routerLink]="['/arbi-configs', configId, 'edit']">
            <mat-icon>edit</mat-icon> Edit
          </button>
          <button mat-stroked-button color="warn" (click)="onDelete()">
            <mat-icon>delete</mat-icon> Delete
          </button>
          <button mat-stroked-button routerLink="/arbi-configs">
            <mat-icon>arrow_back</mat-icon> Back
          </button>
        </div>
      </app-page-header>

      <!-- Config info cards -->
      <div class="info-row" *ngIf="config">
        <app-stat-card label="Trading" [value]="tradingLabel" icon="swap_horiz" color="purple" />
        <app-stat-card label="Profit Asset" [value]="config.profitAsset" icon="attach_money" color="green" />
        <app-stat-card label="Slippage" [value]="(config.slippage * 100 | number:'1.1-2') + '%'" icon="trending_flat" color="orange" />
        <app-stat-card label="Balance" [value]="(config.initialBalance | number:'1.0-2') ?? '0'" icon="account_balance" color="blue" />
      </div>

      <!-- Reference sources chips -->
      <app-content-card *ngIf="config" title="Reference Sources" [compact]="true">
        <div class="ref-chips">
          <span class="chip" *ngFor="let label of referenceLabels">{{ label }}</span>
        </div>
      </app-content-card>

      <!-- Chart -->
      <app-loading-state *ngIf="loading" label="Loading price data…" />

      <div *ngIf="error" class="error-msg">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error }}</span>
      </div>

      <div *ngIf="!loading && !error && series.length > 0" class="chart-section">
        <div class="live-badge" *ngIf="mode === 'live'">
          <span class="dot"></span> LIVE
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

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .mode-toggle {
      margin-right: 8px;
    }

    .info-row {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: t.$spacing-sm;
      margin-bottom: t.$spacing-md;
    }

    .ref-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 16px;
      background: var(--color-background);
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
    }

    .error-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: var(--color-danger, #ef4444);
      justify-content: center;
    }

    .chart-section {
      margin-top: t.$spacing-md;
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
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
    }
  `],
})
export class ArbiConfigDetailPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly configsFacade = inject(ArbiConfigsFacade);
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly liveChartSocket = inject(LiveChartSocketService);
  private readonly cdr = inject(ChangeDetectorRef);

  configId = '';
  config: ArbiConfig | null = null;
  mode: 'historical' | 'live' = 'historical';

  tradingLabel = '';
  referenceLabels: string[] = [];

  series: PriceSeriesConfig[] = [];
  chartData: PricePoint[] = [];
  loading = true;
  error = '';

  private keyPrefixMap = new Map<string, string>();
  private allSubscriptionIds: string[] = [];
  private rxSubs: RxSubscription[] = [];

  ngOnInit(): void {
    this.configId = this.route.snapshot.paramMap.get('id') ?? '';
    this.catalogFacade.loadAll();
    this.configsFacade.loadOne(this.configId);
    this.configsFacade.loadPrices(this.configId);

    // Wait for config + catalog to resolve labels
    const configSub = combineLatest([
      this.configsFacade.selectById(this.configId),
      this.catalogFacade.sources$,
      this.catalogFacade.pairs$,
    ]).pipe(
      filter(([c, sources, pairs]) => !!c && sources.length > 0),
    ).subscribe(([config, sources, pairs]) => {
      if (!config) return;
      this.config = config;

      const sourceMap = new Map(sources.map((s: Source) => [s.id, s]));
      const pairMap = new Map(pairs.map((p: TradingPair) => [p.id, p]));

      this.tradingLabel = this.makeLabel(config.tradingSourceId, config.tradingPairId, sourceMap, pairMap);
      this.referenceLabels = config.sources.map((s) =>
        this.makeLabel(s.sourceId, s.pairId, sourceMap, pairMap),
      );

      this.cdr.markForCheck();
    });
    this.rxSubs.push(configSub);

    // Wait for prices
    const pricesSub = combineLatest([
      this.configsFacade.currentPrices$,
      this.configsFacade.selectById(this.configId),
      this.catalogFacade.sources$,
      this.catalogFacade.pairs$,
    ]).pipe(
      filter(([prices, config, sources]) => !!prices && !!config && sources.length > 0),
      take(1),
    ).subscribe(([pricesResp, config, sources, pairs]) => {
      if (!pricesResp || !config) return;

      const sourceMap = new Map(sources.map((s: Source) => [s.id, s]));
      const pairMap = new Map(pairs.map((p: TradingPair) => [p.id, p]));

      // Build chart subscription infos
      const chartSubs: ChartSubscriptionInfo[] = [];

      // Trading sub
      chartSubs.push({
        id: config.tradingSubscriptionId,
        label: this.makeLabel(config.tradingSourceId, config.tradingPairId, sourceMap, pairMap),
        role: 'trading',
      });

      // Reference subs
      config.sources.forEach((s) => {
        chartSubs.push({
          id: s.subscriptionId,
          label: this.makeLabel(s.sourceId, s.pairId, sourceMap, pairMap),
          role: 'reference',
        });
      });

      const result: MultiChartResult = buildMultiChart(chartSubs, pricesResp.prices);
      this.series = result.series;
      this.chartData = result.data;
      this.keyPrefixMap = result.keyPrefixMap;
      this.allSubscriptionIds = chartSubs.map((s) => s.id);
      this.loading = false;
      this.cdr.markForCheck();
    });
    this.rxSubs.push(pricesSub);

    // Handle price loading error
    const errSub = this.configsFacade.error$.pipe(
      filter((e) => !!e),
      take(1),
    ).subscribe((err) => {
      this.error = err ?? 'Failed to load data';
      this.loading = false;
      this.cdr.markForCheck();
    });
    this.rxSubs.push(errSub);
  }

  ngOnDestroy(): void {
    this.rxSubs.forEach((s) => s.unsubscribe());
    this.liveChartSocket.disconnectAll();
  }

  onModeChange(newMode: string): void {
    this.mode = newMode as 'historical' | 'live';
    if (this.mode === 'live') {
      this.connectSockets();
    } else {
      this.liveChartSocket.disconnectAll();
    }
  }

  onDelete(): void {
    if (confirm('Are you sure you want to delete this config?')) {
      this.configsFacade.delete(this.configId);
    }
  }

  /* ── WebSocket ── */

  private connectSockets(): void {
    if (this.allSubscriptionIds.length === 0) return;

    this.store
      .select(selectAccessToken)
      .pipe(take(1))
      .subscribe((token) => {
        if (!token) return;

        this.liveChartSocket.disconnectAll();
        const wsSub = this.liveChartSocket
          .connectMultiple(token, this.allSubscriptionIds)
          .subscribe({
            next: (msg) => this.onPriceUpdate(msg),
            error: (err) => console.error('ArbiConfig LiveChart WS error:', err),
          });
        this.rxSubs.push(wsSub);
      });
  }

  private onPriceUpdate(msg: MultiLiveChartMessage): void {
    const prefix = this.keyPrefixMap.get(msg.subscriptionId);
    if (!prefix) return;

    const fieldKey = extractFieldKey(msg.key);
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

  private makeLabel(
    sourceId?: string,
    pairId?: string,
    sourceMap?: Map<string, Source>,
    pairMap?: Map<string, TradingPair>,
  ): string {
    if (!sourceId || !pairId) return 'Unknown';
    const src = sourceMap?.get(sourceId)?.displayName ?? sourceId;
    const pair = pairMap?.get(pairId)?.displayName ?? pairId;
    return `${src} — ${pair}`;
  }
}




