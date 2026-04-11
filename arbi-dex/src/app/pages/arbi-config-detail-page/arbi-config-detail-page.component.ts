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
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription as RxSubscription, combineLatest } from 'rxjs';
import { take, filter } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  PriceChartComponent,
  PriceSeriesConfig,
  PricePoint,
  HorizontalLine,
  TradeMarker,
} from '../../shared/ui/price-chart/price-chart.component';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ContentCardComponent } from '../../shared/ui/content-card/content-card.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state/loading-state.component';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { PlaybackPlayerComponent } from '../../shared/ui/playback-player/playback-player.component';
import { ArbiConfigsFacade } from '../../features/arbi-configs/facades/arbi-configs.facade';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import { DemoAccountFacade } from '../../features/demo-account/facades/demo-account.facade';
import {
  LiveChartSocketService,
  MultiLiveChartMessage,
} from '../../features/live-chart/services/live-chart-socket.service';
import { MultiPlaybackService, MultiPlaybackTick } from '../../features/arbi-configs/services/multi-playback.service';
import { AutoTradeEngine } from '../../features/arbi-configs/engine/auto-trade.engine';
import { selectAccessToken } from '../../features/auth/store/auth.selectors';
import {
  buildMultiChart,
  extractFieldKey,
  ChartSubscriptionInfo,
  MultiChartResult,
} from '../../shared/utils/multi-chart-builder';
import {
  ArbiConfig,
  Source,
  TradingPair,
  SwapDirection,
  DemoTrade,
  PlaybackState,
  PlaybackSpeed,
} from '../../shared/models';

const MAX_CHART_POINTS = 2000;

type PageMode = 'historical' | 'live' | 'playback';

@Component({
  selector: 'app-arbi-config-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    PriceChartComponent,
    PageContainerComponent,
    PageHeaderComponent,
    ContentCardComponent,
    LoadingStateComponent,
    StatCardComponent,
    PlaybackPlayerComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        [title]="config?.name ?? 'Config'"
        subtitle="Arbitrage config detail — chart, trading & auto-trade">
        <div slot="actions" class="header-actions">
          <mat-button-toggle-group
            [value]="mode"
            (change)="onModeChange($event.value)"
            appearance="standard"
            class="mode-toggle">
            <mat-button-toggle value="historical">
              <mat-icon>history</mat-icon> Historical
            </mat-button-toggle>
            <mat-button-toggle value="playback">
              <mat-icon>play_circle</mat-icon> Playback
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

      <!-- ── PLAYBACK MODE: Player Controls ── -->
      <ng-container *ngIf="mode === 'playback'">
        <app-content-card title="Playback Controls" [compact]="true">
          <div *ngIf="playbackState.loading" class="playback-loading">
            <mat-icon>hourglass_top</mat-icon> Loading historical data…
          </div>
          <div *ngIf="playbackState.error" class="error-msg">
            <mat-icon>error_outline</mat-icon>
            <span>{{ playbackState.error }}</span>
          </div>
          <app-playback-player
            *ngIf="!playbackState.loading && !playbackState.error && playbackState.totalPoints > 0"
            [state]="playbackState"
            (play)="onPlaybackPlay()"
            (pause)="onPlaybackPause()"
            (stop)="onPlaybackStop()"
            (speedChange)="onPlaybackSpeedChange($event)"
            (seek)="onPlaybackSeek($event)" />
        </app-content-card>
      </ng-container>

      <!-- Chart -->
      <app-loading-state *ngIf="loading" label="Loading price data…" />

      <div *ngIf="error" class="error-msg">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error }}</span>
      </div>

      <app-content-card *ngIf="!loading && !error && series.length > 0" title="Price Chart">
        <ng-container slot="header-actions">
          <div class="live-badge" *ngIf="mode === 'live'">
            <span class="dot"></span> LIVE
          </div>
          <div class="live-badge live-badge--playback" *ngIf="mode === 'playback' && playbackState.isPlaying">
            <span class="dot"></span> PLAYBACK {{ playbackState.speed }}×
          </div>
          <button mat-icon-button
                  (click)="chartVisible = !chartVisible"
                  [matTooltip]="chartVisible ? 'Hide chart' : 'Show chart'">
            <mat-icon>{{ chartVisible ? 'expand_less' : 'expand_more' }}</mat-icon>
          </button>
        </ng-container>
        <app-price-chart
          *ngIf="chartVisible"
          [series]="series"
          [data]="chartData"
          [horizontalLines]="hLines"
          [tradeMarkers]="tradeMarkersList"
          [streaming]="false" />
      </app-content-card>

      <!-- ── TRADING SECTION (only in playback / live) ── -->
      <ng-container *ngIf="config && (mode === 'playback' || mode === 'live')">

        <!-- Balance cards -->
        <div class="info-row" style="margin-top: 16px;">
          <app-stat-card label="USDC Balance"
            [value]="(usdcBalance | number:'1.2-2') ?? '0.00'"
            icon="attach_money" color="green" />
          <app-stat-card label="WETH Balance"
            [value]="(wethBalance | number:'1.4-8') ?? '0.00000000'"
            icon="currency_exchange" color="purple" />
          <app-stat-card label="Portfolio (USDC)"
            [value]="(portfolioValue | number:'1.2-2') ?? '0.00'"
            icon="account_balance"
            [color]="pnl >= 0 ? 'green' : 'orange'" />
          <app-stat-card label="P&L"
            [value]="pnlDisplay"
            icon="trending_up"
            [color]="pnl >= 0 ? 'green' : 'orange'" />
        </div>

        <!-- Quote info -->
        <app-content-card *ngIf="tradingMid > 0" title="Trading Source Quote" [compact]="true">
          <div class="quote-info-row">
            <div class="quote-item quote-item--bid">
              <span class="quote-item__label">Bid</span>
              <span class="quote-item__value">{{ tradingBid | number:'1.2-4' }}</span>
            </div>
            <div class="quote-item quote-item--ask">
              <span class="quote-item__label">Ask</span>
              <span class="quote-item__value">{{ tradingAsk | number:'1.2-4' }}</span>
            </div>
            <div class="quote-item">
              <span class="quote-item__label">Mid</span>
              <span class="quote-item__value">{{ tradingMid | number:'1.2-4' }}</span>
            </div>
            <div class="quote-item">
              <span class="quote-item__label">Avg Ref Mid</span>
              <span class="quote-item__value">{{ avgRefMid | number:'1.2-4' }}</span>
            </div>
            <div class="quote-item" *ngIf="engine?.hasPosition">
              <span class="quote-item__label">Peak</span>
              <span class="quote-item__value">{{ engine!.peakSellPrice | number:'1.2-4' }}</span>
            </div>
          </div>
        </app-content-card>

        <!-- Auto-trade toggle + Manual swap -->
        <app-content-card title="Trading" [elevated]="true">
          <div class="trading-header">
            <mat-slide-toggle [(ngModel)]="autoTradeEnabled" class="auto-toggle">
              Auto-Trade
            </mat-slide-toggle>
            <span class="auto-status" *ngIf="autoTradeEnabled && engine">
              {{ engine.hasPosition ? '🟢 In Position' : '⏳ Waiting for signal' }}
            </span>
            <span class="auto-reason" *ngIf="lastAutoTradeReason">{{ lastAutoTradeReason }}</span>
          </div>

          <!-- Manual swap form -->
          <div class="swap-form" *ngIf="!autoTradeEnabled">
            <div class="swap-row">
              <mat-form-field appearance="outline" class="swap-field">
                <mat-label>{{ direction === 'USDC_TO_WETH' ? 'Spend USDC' : 'Spend WETH' }}</mat-label>
                <input matInput type="number" [(ngModel)]="amountIn" (ngModelChange)="recalcEstimate()"
                       min="0" [step]="direction === 'USDC_TO_WETH' ? 10 : 0.001" />
                <span matTextSuffix class="token-suffix">{{ direction === 'USDC_TO_WETH' ? 'USDC' : 'WETH' }}</span>
              </mat-form-field>

              <button mat-icon-button class="flip-btn" (click)="flipDirection()" matTooltip="Flip direction">
                <mat-icon>swap_vert</mat-icon>
              </button>

              <div class="estimate-box">
                <span class="estimate-label">You receive ≈</span>
                <span class="estimate-value">
                  {{ estimatedOut | number:(direction === 'USDC_TO_WETH' ? '1.4-8' : '1.2-4') }}
                  {{ direction === 'USDC_TO_WETH' ? 'WETH' : 'USDC' }}
                </span>
              </div>
            </div>

            <div class="action-row">
              <button mat-stroked-button (click)="setMax()">MAX</button>
              <button mat-flat-button color="primary" class="swap-btn"
                      [disabled]="!canSwap"
                      (click)="doSwap()">
                <mat-icon>swap_horiz</mat-icon>
                {{ direction === 'USDC_TO_WETH' ? 'Buy WETH' : 'Sell WETH' }}
              </button>
            </div>
          </div>
        </app-content-card>

        <!-- Trade History -->
        <app-content-card [title]="'Trade History (' + trades.length + ')'" *ngIf="trades.length > 0">
          <button slot="header-actions" mat-icon-button
                  (click)="showTradeHistory = !showTradeHistory"
                  [matTooltip]="showTradeHistory ? 'Hide table' : 'Show table'">
            <mat-icon>{{ showTradeHistory ? 'expand_less' : 'expand_more' }}</mat-icon>
          </button>
          <div class="trade-table-wrap" *ngIf="showTradeHistory">
            <table class="trade-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Step</th>
                  <th>Direction</th>
                  <th>Spent</th>
                  <th>Received</th>
                  <th>Price</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of trades">
                  <td>{{ t.id }}</td>
                  <td>{{ t.step != null ? t.step : '—' }}</td>
                  <td>
                    <span [class]="t.direction === 'USDC_TO_WETH' ? 'dir-buy' : 'dir-sell'">
                      {{ t.direction === 'USDC_TO_WETH' ? 'BUY' : 'SELL' }}
                    </span>
                  </td>
                  <td>{{ t.amountIn | number:(t.tokenIn === 'USDC' ? '1.2-2' : '1.4-8') }} {{ t.tokenIn }}</td>
                  <td>{{ t.amountOut | number:(t.tokenOut === 'USDC' ? '1.2-2' : '1.4-8') }} {{ t.tokenOut }}</td>
                  <td>{{ t.price | number:'1.2-4' }}</td>
                  <td>{{ (t.playbackTime ?? t.timestamp) | date:'HH:mm:ss' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </app-content-card>

      </ng-container>
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

    .mode-toggle { margin-right: 8px; }

    .info-row {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: t.$spacing-sm;
      margin-bottom: t.$spacing-md;
    }

    .ref-chips { display: flex; flex-wrap: wrap; gap: 6px; }

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

    .playback-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-text-muted);
      padding: 8px 0;
    }


    .live-badge, .live-badge--playback {
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
        width: 8px; height: 8px; border-radius: 50%;
        background: currentColor;
        animation: pulse 1.5s ease-in-out infinite;
      }
    }
    .live-badge--playback {
      background: rgba(33, 150, 243, 0.15);
      border-color: #2196f3;
      color: #2196f3;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
    }

    app-content-card { display: block; margin-bottom: t.$spacing-md; }

    /* ── Quote info ── */
    .quote-info-row {
      display: flex;
      gap: t.$spacing-lg;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    .quote-item {
      display: flex; flex-direction: column; gap: 2px;
      &__label {
        font-size: t.$font-size-xs;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      &__value {
        font-size: t.$font-size-lg;
        font-weight: t.$font-weight-bold;
        color: var(--color-text-primary);
      }
      &--bid .quote-item__value { color: #0ecb81; }
      &--ask .quote-item__value { color: #f6465d; }
    }

    /* ── Trading section ── */
    .trading-header {
      display: flex;
      align-items: center;
      gap: t.$spacing-md;
      margin-bottom: t.$spacing-md;
      flex-wrap: wrap;
    }
    .auto-toggle { font-weight: 600; }
    .auto-status {
      font-size: t.$font-size-sm;
      color: var(--color-text-secondary);
    }
    .auto-reason {
      font-size: t.$font-size-xs;
      color: var(--color-text-muted);
      font-style: italic;
    }

    .swap-form {
      display: flex;
      flex-direction: column;
      gap: t.$spacing-md;
    }
    .swap-row {
      display: flex;
      align-items: center;
      gap: t.$spacing-md;
      flex-wrap: wrap;
    }
    .swap-field { flex: 1; min-width: 200px; }
    .flip-btn {
      color: var(--color-text-secondary);
      transition: transform 0.3s ease;
      &:hover { transform: rotate(180deg); color: var(--color-text-primary); }
    }
    .estimate-box {
      flex: 1; min-width: 180px;
      display: flex; flex-direction: column;
      padding: t.$spacing-md;
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: t.$radius-sm;
    }
    .estimate-label {
      font-size: t.$font-size-xs;
      color: var(--color-text-muted);
      margin-bottom: 4px;
    }
    .estimate-value {
      font-size: t.$font-size-lg;
      font-weight: t.$font-weight-bold;
      color: var(--color-text-primary);
    }
    .token-suffix {
      font-weight: t.$font-weight-semibold;
      color: var(--color-text-muted);
    }
    .action-row { display: flex; align-items: center; gap: t.$spacing-md; }
    .swap-btn {
      flex: 1; height: 48px;
      font-size: t.$font-size-base;
      font-weight: t.$font-weight-semibold;
    }

    /* Trade table */
    .trade-table-wrap { overflow-x: auto; }
    .trade-table {
      width: 100%; border-collapse: collapse; font-size: t.$font-size-sm;
      th, td {
        padding: 8px 12px; text-align: left;
        border-bottom: 1px solid var(--color-border);
        white-space: nowrap;
      }
      th {
        color: var(--color-text-muted);
        font-weight: t.$font-weight-semibold;
        font-size: t.$font-size-xs;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      td { color: var(--color-text-primary); }
    }
    .dir-buy { color: #0ecb81; font-weight: 600; }
    .dir-sell { color: #f6465d; font-weight: 600; }
  `],
})
export class ArbiConfigDetailPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly configsFacade = inject(ArbiConfigsFacade);
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly demoFacade = inject(DemoAccountFacade);
  private readonly liveChartSocket = inject(LiveChartSocketService);
  private readonly multiPlayback = inject(MultiPlaybackService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);

  configId = '';
  config: ArbiConfig | null = null;
  mode: PageMode = 'historical';

  tradingLabel = '';
  referenceLabels: string[] = [];

  // Chart
  series: PriceSeriesConfig[] = [];
  chartData: PricePoint[] = [];
  hLines: HorizontalLine[] = [];
  loading = true;
  error = '';
  chartVisible = true;

  // Оригинальные исторические данные (для восстановления при переключении обратно)
  private historicalSeries: PriceSeriesConfig[] = [];
  private historicalChartData: PricePoint[] = [];

  // Playback
  playbackState: PlaybackState = {
    isPlaying: false, speed: 1, currentTime: 0, startTime: 0, endTime: 0,
    progress: 0, totalPoints: 0, currentIndex: 0, loading: false, error: '',
  };
  private allPlaybackPoints: PricePoint[] = [];

  // Trading prices
  tradingBid = 0;
  tradingAsk = 0;
  tradingMid = 0;
  avgRefMid = 0;

  // Demo account
  usdcBalance = 100;
  wethBalance = 0;
  initialUsdc = 100;
  portfolioValue = 100;
  pnl = 0;
  pnlDisplay = '+0.00 USDC';

  // Swap form
  direction: SwapDirection = 'USDC_TO_WETH';
  amountIn = 100;
  estimatedOut = 0;
  trades: DemoTrade[] = [];
  tradeMarkersList: TradeMarker[] = [];
  showTradeHistory = false;

  // Auto-trade
  autoTradeEnabled = false;
  engine: AutoTradeEngine | null = null;
  lastAutoTradeReason = '';

  // Актуальный step/time из последнего тика (не из state, т.к. state обновляется после батча)
  private lastTickIndex = 0;
  private lastTickTime = 0;

  private keyPrefixMap = new Map<string, string>();
  private allSubscriptionIds: string[] = [];
  private tradingSubId = '';
  private referenceSubIds: string[] = [];
  private liveValues = new Map<string, { bid: number; ask: number; mid: number }>();
  private chartSubs: ChartSubscriptionInfo[] = [];
  private rxSubs: RxSubscription[] = [];

  get canSwap(): boolean {
    if (this.amountIn <= 0 || this.tradingMid <= 0) return false;
    if (this.direction === 'USDC_TO_WETH') return this.amountIn <= this.usdcBalance;
    return this.amountIn <= this.wethBalance;
  }

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
      filter(([c, sources]) => !!c && sources.length > 0),
    ).subscribe(([config, sources, pairs]) => {
      if (!config) return;
      this.config = config;

      const sourceMap = new Map(sources.map((s: Source) => [s.id, s]));
      const pairMap = new Map(pairs.map((p: TradingPair) => [p.id, p]));

      this.tradingLabel = this.makeLabel(config.tradingSourceId, config.tradingPairId, sourceMap, pairMap);
      this.referenceLabels = config.sources.map((s) =>
        this.makeLabel(s.sourceId, s.pairId, sourceMap, pairMap),
      );

      this.tradingSubId = config.tradingSubscriptionId;
      this.referenceSubIds = config.sources.map((s) => s.subscriptionId);

      // Init demo balance from config
      this.demoFacade.setInitialBalance(config.initialBalance);
      this.amountIn = config.initialBalance;

      // Init auto-trade engine
      this.engine = new AutoTradeEngine(config);

      this.cdr.markForCheck();
    });
    this.rxSubs.push(configSub);

    // Wait for prices (historical mode chart data)
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

      this.chartSubs = [];
      this.chartSubs.push({
        id: config.tradingSubscriptionId,
        label: this.makeLabel(config.tradingSourceId, config.tradingPairId, sourceMap, pairMap),
        role: 'trading',
      });
      config.sources.forEach((s) => {
        this.chartSubs.push({
          id: s.subscriptionId,
          label: this.makeLabel(s.sourceId, s.pairId, sourceMap, pairMap),
          role: 'reference',
        });
      });

      const result: MultiChartResult = buildMultiChart(this.chartSubs, pricesResp.prices);
      this.series = result.series;
      this.chartData = result.data;
      this.keyPrefixMap = result.keyPrefixMap;
      this.allSubscriptionIds = this.chartSubs.map((s) => s.id);

      // Сохраняем оригинальные исторические данные для переключения обратно на historical
      this.historicalSeries = [...result.series];
      this.historicalChartData = [...result.data];

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

    // Subscribe to demo account state
    const demoSub = combineLatest([
      this.demoFacade.usdcBalance$,
      this.demoFacade.wethBalance$,
      this.demoFacade.initialUsdc$,
      this.demoFacade.tradeHistory$,
    ]).subscribe(([usdc, weth, initial, history]) => {
      this.usdcBalance = usdc;
      this.wethBalance = weth;
      this.initialUsdc = initial;
      this.trades = history;
      this.updateTradeMarkers();
      this.updatePortfolio();
      this.recalcEstimate();
      this.cdr.markForCheck();
    });
    this.rxSubs.push(demoSub);

    // Subscribe to playback state
    const pbStateSub = this.multiPlayback.state$.subscribe((s) => {
      this.playbackState = s;
      this.cdr.markForCheck();
    });
    this.rxSubs.push(pbStateSub);
  }

  ngOnDestroy(): void {
    this.rxSubs.forEach((s) => s.unsubscribe());
    this.liveChartSocket.disconnectAll();
    this.multiPlayback.stop();
  }

  /* ── Mode switching ── */

  onModeChange(newMode: string): void {
    const m = newMode as PageMode;
    if (m === this.mode) return;

    if (this.mode === 'live') {
      this.liveChartSocket.disconnectAll();
      this.liveValues.clear();
    }
    if (this.mode === 'playback') this.multiPlayback.stop();

    this.mode = m;

    if (m === 'live') {
      this.connectSockets();
    } else if (m === 'playback') {
      this.startPlaybackMode();
    } else if (m === 'historical') {
      // Восстанавливаем оригинальные исторические данные
      this.series = [...this.historicalSeries];
      this.chartData = [...this.historicalChartData];
      this.hLines = [];
    }
    this.cdr.markForCheck();
  }

  onDelete(): void {
    if (confirm('Are you sure you want to delete this config?')) {
      this.configsFacade.delete(this.configId);
    }
  }

  /* ── Playback controls ── */

  onPlaybackPlay(): void { this.multiPlayback.play(); }
  onPlaybackPause(): void { this.multiPlayback.pause(); }

  onPlaybackStop(): void {
    this.multiPlayback.stop();
    this.resetTradeState();
    this.startPlaybackMode();
  }

  onPlaybackSpeedChange(speed: PlaybackSpeed): void {
    this.multiPlayback.setSpeed(speed);
  }

  onPlaybackSeek(progress: number): void {
    this.multiPlayback.seekTo(progress);
    if (this.allPlaybackPoints.length > 0) {
      const idx = Math.min(
        Math.floor(progress * this.allPlaybackPoints.length),
        this.allPlaybackPoints.length - 1,
      );
      this.chartData = this.allPlaybackPoints.slice(0, idx + 1);
      this.cdr.markForCheck();
    }
  }

  /* ── Manual swap ── */

  flipDirection(): void {
    if (this.direction === 'USDC_TO_WETH') {
      this.direction = 'WETH_TO_USDC';
      this.amountIn = this.wethBalance;
    } else {
      this.direction = 'USDC_TO_WETH';
      this.amountIn = this.usdcBalance;
    }
    this.recalcEstimate();
  }

  setMax(): void {
    this.amountIn = this.direction === 'USDC_TO_WETH' ? this.usdcBalance : this.wethBalance;
    this.recalcEstimate();
  }

  recalcEstimate(): void {
    if (this.tradingMid <= 0 || this.amountIn <= 0) {
      this.estimatedOut = 0;
      return;
    }
    const slip = this.config?.slippage ?? 0.01;
    if (this.direction === 'USDC_TO_WETH') {
      const price = this.tradingAsk > 0 ? this.tradingAsk : this.tradingMid;
      this.estimatedOut = this.amountIn / (price * (1 + slip));
    } else {
      const price = this.tradingBid > 0 ? this.tradingBid : this.tradingMid;
      this.estimatedOut = this.amountIn * (price * (1 - slip));
    }
  }

  doSwap(): void {
    if (!this.canSwap) return;
    const slip = this.config?.slippage ?? 0.01;
    const { step, playbackTime } = this.currentPlaybackInfo();
    // Покупка по ask, продажа по bid (как на реальном рынке)
    const execPrice = this.direction === 'USDC_TO_WETH'
      ? (this.tradingAsk > 0 ? this.tradingAsk : this.tradingMid)
      : (this.tradingBid > 0 ? this.tradingBid : this.tradingMid);
    this.demoFacade.swap(this.direction, this.amountIn, slip, execPrice, step, playbackTime);
    this.snackBar.open(
      `Swap: ${this.amountIn.toFixed(2)} ${this.direction === 'USDC_TO_WETH' ? 'USDC → WETH' : 'WETH → USDC'}`,
      'OK', { duration: 3000 },
    );

    if (this.engine) {
      if (this.direction === 'USDC_TO_WETH') {
        this.engine.onBuy(this.tradingAsk > 0 ? this.tradingAsk : this.tradingMid);
      } else {
        this.engine.onSell();
      }
    }
    this.updateHorizontalLines();
  }

  /* ── Playback Mode ── */

  private startPlaybackMode(): void {
    if (this.chartSubs.length === 0) return;

    // Используем данные из store — те же, что и для historical режима
    const sub = this.configsFacade.currentPrices$.pipe(
      filter((prices) => !!prices),
      take(1),
    ).subscribe((pricesResp) => {
      if (!pricesResp) return;

      const result = this.multiPlayback.loadFromData(this.chartSubs, pricesResp.prices);
      if (!result || result.data.length === 0) return;

      this.series = result.series;
      this.allPlaybackPoints = [...result.data];
      this.keyPrefixMap = result.keyPrefixMap;
      this.chartData = [];
      this.cdr.markForCheck();

      const tickSub = this.multiPlayback.tick$.subscribe((tick) => {
        this.onPlaybackTick(tick);
      });
      this.rxSubs.push(tickSub);
    });
    this.rxSubs.push(sub);
  }

  private onPlaybackTick(tick: MultiPlaybackTick): void {
    // Сохраняем актуальный step/time из тика (state обновляется после батча, а тик — для каждой точки)
    this.lastTickIndex = tick.index;
    this.lastTickTime = tick.time;

    // Only update chart data if chart is visible (major performance gain)
    if (this.chartVisible) {
      const targetLen = tick.index + 1;
      if (targetLen <= this.allPlaybackPoints.length && this.chartData.length < targetLen) {
        this.chartData = this.allPlaybackPoints.slice(0, targetLen);
      }
    }

    this.extractPricesFromTick(tick);
    this.runAutoTrade();
    this.updatePortfolio();
    this.updateHorizontalLines();
    this.cdr.markForCheck();
  }

  /* ── WebSocket (Live Mode) ── */

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
            next: (msg) => this.onLivePriceUpdate(msg),
            error: (err) => console.error('ArbiConfig LiveChart WS error:', err),
          });
        this.rxSubs.push(wsSub);
      });
  }

  private onLivePriceUpdate(msg: MultiLiveChartMessage): void {
    const prefix = this.keyPrefixMap.get(msg.subscriptionId);
    if (!prefix) return;

    const fieldKey = extractFieldKey(msg.key);

    // Only update chart data if chart is visible
    if (this.chartVisible) {
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
    }

    // Update live values (always, for trading logic)
    const existing = this.liveValues.get(msg.subscriptionId) ?? { bid: 0, ask: 0, mid: 0 };
    const keyLower = fieldKey.toLowerCase();
    if (keyLower.includes('bid')) existing.bid = msg.point.v;
    else if (keyLower.includes('ask')) existing.ask = msg.point.v;
    else if (keyLower.includes('mid')) existing.mid = msg.point.v;
    if (existing.bid > 0 && existing.ask > 0 && existing.mid === 0) {
      existing.mid = (existing.bid + existing.ask) / 2;
    }
    this.liveValues.set(msg.subscriptionId, existing);

    this.derivePricesFromLive();
    this.runAutoTrade();
    this.updatePortfolio();
    this.updateHorizontalLines();
    this.cdr.markForCheck();
  }

  /* ── Price extraction ── */

  private extractPricesFromTick(tick: MultiPlaybackTick): void {
    const trading = tick.values.get(this.tradingSubId);
    if (trading) {
      this.tradingBid = trading.bid;
      this.tradingAsk = trading.ask;
      this.tradingMid = trading.mid;
    }

    let refSum = 0;
    let refCount = 0;
    for (const refId of this.referenceSubIds) {
      const ref = tick.values.get(refId);
      if (ref && ref.mid > 0) {
        refSum += ref.mid;
        refCount++;
      }
    }
    this.avgRefMid = refCount > 0 ? refSum / refCount : 0;
  }

  private derivePricesFromLive(): void {
    const trading = this.liveValues.get(this.tradingSubId);
    if (trading) {
      if (trading.bid > 0) this.tradingBid = trading.bid;
      if (trading.ask > 0) this.tradingAsk = trading.ask;
      if (trading.bid > 0 && trading.ask > 0) {
        this.tradingMid = (trading.bid + trading.ask) / 2;
      } else if (trading.mid > 0) {
        this.tradingMid = trading.mid;
      }
    }

    let refSum = 0;
    let refCount = 0;
    for (const refId of this.referenceSubIds) {
      const ref = this.liveValues.get(refId);
      if (ref) {
        const mid = ref.mid > 0 ? ref.mid : (ref.bid > 0 && ref.ask > 0 ? (ref.bid + ref.ask) / 2 : 0);
        if (mid > 0) { refSum += mid; refCount++; }
      }
    }
    this.avgRefMid = refCount > 0 ? refSum / refCount : 0;
  }

  /* ── Auto-Trade Engine ── */

  private runAutoTrade(): void {
    if (!this.autoTradeEnabled || !this.engine || !this.config) return;
    if (this.tradingBid <= 0 || this.tradingAsk <= 0 || this.avgRefMid <= 0) return;

    const result = this.engine.tick(this.tradingBid, this.tradingAsk, this.avgRefMid);

    if (result.action === 'buy') {
      const tradeAmountPct = this.config.tradeAmountPct ?? 100;
      const amount = this.usdcBalance * (tradeAmountPct / 100);
      if (amount > 0) {
        const { step, playbackTime } = this.currentPlaybackInfo();
        // Покупка по ask (как на реальном рынке)
        const buyPrice = this.tradingAsk > 0 ? this.tradingAsk : this.tradingMid;
        this.demoFacade.swap('USDC_TO_WETH', amount, this.config.slippage, buyPrice, step, playbackTime);
        this.engine.onBuy(this.tradingAsk);
        this.lastAutoTradeReason = result.reason ?? 'Auto-buy';
        this.snackBar.open(`🤖 Auto-BUY: ${amount.toFixed(2)} USDC`, 'OK', { duration: 3000 });
      }
    } else if (result.action === 'sell') {
      if (this.wethBalance > 0) {
        const { step, playbackTime } = this.currentPlaybackInfo();
        // Продажа по bid (как на реальном рынке)
        const sellPrice = this.tradingBid > 0 ? this.tradingBid : this.tradingMid;
        this.demoFacade.swap('WETH_TO_USDC', this.wethBalance, this.config.slippage, sellPrice, step, playbackTime);
        this.engine.onSell();
        this.lastAutoTradeReason = result.reason ?? 'Auto-sell';
        this.snackBar.open(`🤖 Auto-SELL: ${this.wethBalance.toFixed(8)} WETH`, 'OK', { duration: 3000 });
      }
    }
  }

  /* ── Horizontal Lines ── */

  private updateHorizontalLines(): void {
    const lines: HorizontalLine[] = [];

    if (this.engine && this.engine.hasPosition) {
      if (this.engine.buyPrice > 0) {
        lines.push({ value: this.engine.buyPrice, color: '#0ecb81', label: 'Buy Price' });
      }
      if (this.engine.trailingSellLevel > 0) {
        lines.push({ value: this.engine.trailingSellLevel, color: '#2196f3', label: 'Trailing TP' });
      }
      const slLevel = this.engine.stopLossLevel;
      if (slLevel > 0) {
        lines.push({ value: slLevel, color: '#f6465d', label: 'Stop Loss' });
      }
      if (this.engine.peakSellPrice > 0) {
        lines.push({ value: this.engine.peakSellPrice, color: '#ff9800', label: 'Peak', dash: true });
      }
    } else if (this.engine && !this.engine.hasPosition && this.avgRefMid > 0) {
      const autoBuyLevel = this.engine.getAutoBuyLevel(this.avgRefMid);
      if (autoBuyLevel > 0) {
        lines.push({ value: autoBuyLevel, color: '#ffeb3b', label: 'Auto-Buy Level' });
      }
    }

    this.hLines = lines;
  }

  /* ── Helpers ── */

  /** Возвращает текущий номер шага и время playback (если в playback-режиме) */
  private currentPlaybackInfo(): { step?: number; playbackTime?: number } {
    if (this.mode === 'playback') {
      return { step: this.lastTickIndex, playbackTime: this.lastTickTime };
    }
    return {};
  }

  private updateTradeMarkers(): void {
    this.tradeMarkersList = this.trades.map((t) => ({
      time: t.playbackTime ?? t.timestamp,
      price: t.price,
      direction: t.direction === 'USDC_TO_WETH' ? 'buy' as const : 'sell' as const,
      label: t.direction === 'USDC_TO_WETH' ? 'BUY' : 'SELL',
    }));
  }

  private updatePortfolio(): void {
    if (this.tradingMid > 0) {
      this.portfolioValue = this.usdcBalance + this.wethBalance * this.tradingMid;
    } else {
      this.portfolioValue = this.usdcBalance;
    }
    this.pnl = this.portfolioValue - this.initialUsdc;
    const sign = this.pnl >= 0 ? '+' : '';
    this.pnlDisplay = `${sign}${this.pnl.toFixed(2)} USDC`;
  }

  private resetTradeState(): void {
    this.demoFacade.setInitialBalance(this.config?.initialBalance ?? 100);
    this.engine?.reset();
    this.lastAutoTradeReason = '';
    this.tradingBid = 0;
    this.tradingAsk = 0;
    this.tradingMid = 0;
    this.avgRefMid = 0;
    this.hLines = [];
    this.direction = 'USDC_TO_WETH';
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








