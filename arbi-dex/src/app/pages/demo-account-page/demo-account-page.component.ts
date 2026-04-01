import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription as RxSubscription, combineLatest } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { ContentCardComponent } from '../../shared/ui/content-card/content-card.component';
import { DemoAccountFacade } from '../../features/demo-account/facades/demo-account.facade';
import { QuotesFacade } from '../../features/quotes/facades/quotes.facade';
import { SubscriptionsFacade } from '../../features/subscriptions/facades/subscriptions.facade';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import {
  LiveChartSocketService,
  LiveChartMessage,
} from '../../features/live-chart/services/live-chart-socket.service';
import { selectAccessToken } from '../../features/auth/store/auth.selectors';
import { Quote, SwapDirection, DemoTrade, Subscription, Source, TradingPair } from '../../shared/models';

@Component({
  selector: 'app-demo-account-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatSnackBarModule,
    PageContainerComponent,
    PageHeaderComponent,
    StatCardComponent,
    ContentCardComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        title="Demo Account"
        subtitle="Simulated USDC ↔ WETH trading with live prices">
        <div slot="actions">
          <button mat-stroked-button (click)="resetAccount()" matTooltip="Reset to initial balance">
            <mat-icon>restart_alt</mat-icon> Reset
          </button>
        </div>
      </app-page-header>

      <!-- Балансы -->
      <div class="balance-row">
        <app-stat-card
          label="USDC Balance"
          [value]="(usdcBalance | number:'1.2-2') ?? '0.00'"
          icon="attach_money"
          color="green" />
        <app-stat-card
          label="WETH Balance"
          [value]="(wethBalance | number:'1.4-8') ?? '0.00000000'"
          icon="currency_exchange"
          color="purple" />
        <app-stat-card
          label="Portfolio (USDC)"
          [value]="(portfolioValue | number:'1.2-2') ?? '0.00'"
          icon="account_balance"
          [color]="pnl >= 0 ? 'green' : 'orange'" />
        <app-stat-card
          label="P&L"
          [value]="pnlDisplay"
          icon="trending_up"
          [color]="pnl >= 0 ? 'green' : 'orange'" />
      </div>

      <!-- Настройка начального баланса -->
      <app-content-card title="Initial Balance" [compact]="true">
        <div class="initial-balance-row">
          <mat-form-field appearance="outline" class="field-sm">
            <mat-label>Starting USDC</mat-label>
            <input matInput type="number" [(ngModel)]="initialUsdcInput" min="1" step="10" />
          </mat-form-field>
          <button mat-flat-button color="primary" (click)="applyInitialBalance()">
            Apply & Reset
          </button>
        </div>
      </app-content-card>

      <!-- Котировка Arbitrum DEX — WETH/USDC -->
      <app-content-card title="Arbitrum DEX — WETH/USDC" [compact]="true" *ngIf="midPrice > 0">
        <div class="quote-info-row">
          <div class="quote-item quote-item--bid">
            <span class="quote-item__label">Bid (покупка)</span>
            <span class="quote-item__value">{{ bidPrice | number:'1.2-4' }} <small>USDC</small></span>
          </div>
          <div class="quote-item quote-item--ask">
            <span class="quote-item__label">Ask (продажа)</span>
            <span class="quote-item__value">{{ askPrice | number:'1.2-4' }} <small>USDC</small></span>
          </div>
          <div class="quote-item">
            <span class="quote-item__label">Mid</span>
            <span class="quote-item__value">{{ midPrice | number:'1.2-4' }} <small>USDC</small></span>
          </div>
          <div class="quote-item">
            <span class="quote-item__label">Spread</span>
            <span class="quote-item__value">{{ spreadPct | number:'1.4-4' }}%</span>
          </div>
          <div class="quote-item quote-item--ts">
            <span class="quote-item__label">Updated</span>
            <span class="quote-item__value">{{ quoteTimestamp | date:'HH:mm:ss.SSS' }}</span>
          </div>
          <div class="quote-item quote-item--live">
            <span class="live-badge-sm"><span class="dot"></span> LIVE</span>
          </div>
        </div>
      </app-content-card>

      <div *ngIf="wsError" class="error-msg">
        <mat-icon>error_outline</mat-icon>
        <span>{{ wsError }}</span>
      </div>

      <!-- Форма свопа -->
      <app-content-card title="Swap" [elevated]="true">
        <div class="swap-form">
          <!-- Верхняя строка: ввод -->
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
              <span class="estimate-rate" *ngIf="midPrice > 0">
                1 WETH = {{ midPrice | number:'1.2-2' }} USDC
              </span>
            </div>
          </div>

          <!-- Slippage -->
          <div class="slippage-row">
            <mat-form-field appearance="outline" class="field-sm">
              <mat-label>Slippage %</mat-label>
              <input matInput type="number" [(ngModel)]="slippagePct" (ngModelChange)="recalcEstimate()"
                     min="0" max="50" step="0.01" />
              <span matTextSuffix>%</span>
            </mat-form-field>
            <span class="price-info" *ngIf="midPrice > 0">
              <span class="live-dot"></span>
              <strong>{{ priceSourceLabel }} — WETH/USDC</strong>
            </span>
            <span class="price-info price-info--warn" *ngIf="midPrice === 0 && !wsError">
              <mat-icon>warning</mat-icon> Connecting to price feed…
            </span>
          </div>

          <!-- Max кнопка + Swap кнопка -->
          <div class="action-row">
            <button mat-stroked-button (click)="setMax()">MAX</button>
            <button mat-flat-button color="primary" class="swap-btn"
                    [disabled]="!canSwap || loading"
                    (click)="doSwap()">
              <mat-icon>swap_horiz</mat-icon>
              {{ direction === 'USDC_TO_WETH' ? 'Buy WETH' : 'Sell WETH' }}
            </button>
          </div>
        </div>
      </app-content-card>

      <!-- История сделок -->
      <app-content-card title="Trade History" *ngIf="trades.length > 0">
        <div class="trade-table-wrap">
          <table class="trade-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Direction</th>
                <th>Spent</th>
                <th>Received</th>
                <th>Price</th>
                <th>Slippage</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let t of trades">
                <td>{{ t.id }}</td>
                <td>
                  <span [class]="t.direction === 'USDC_TO_WETH' ? 'dir-buy' : 'dir-sell'">
                    {{ t.direction === 'USDC_TO_WETH' ? 'BUY' : 'SELL' }}
                  </span>
                </td>
                <td>{{ t.amountIn | number:(t.tokenIn === 'USDC' ? '1.2-2' : '1.4-8') }} {{ t.tokenIn }}</td>
                <td>{{ t.amountOut | number:(t.tokenOut === 'USDC' ? '1.2-2' : '1.4-8') }} {{ t.tokenOut }}</td>
                <td>{{ t.price | number:'1.2-4' }}</td>
                <td>{{ t.slippage * 100 | number:'1.2-2' }}%</td>
                <td>{{ t.timestamp | date:'HH:mm:ss' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </app-content-card>
    </app-page-container>
  `,
  styles: [`
    @use 'styles/tokens' as t;

    .balance-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: t.$spacing-md;
      margin-bottom: t.$spacing-lg;
    }

    .initial-balance-row {
      display: flex;
      align-items: center;
      gap: t.$spacing-md;
    }

    app-content-card {
      display: block;
      margin-bottom: t.$spacing-lg;
    }

    .error-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: var(--color-danger, #ef4444);
      justify-content: center;
      margin-bottom: t.$spacing-md;
    }

    /* ── Quote info row ── */
    .quote-info-row {
      display: flex;
      gap: t.$spacing-lg;
      flex-wrap: wrap;
      align-items: flex-end;
    }

    .quote-item {
      display: flex;
      flex-direction: column;
      gap: 2px;

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

        small {
          font-size: t.$font-size-xs;
          font-weight: t.$font-weight-medium;
          color: var(--color-text-muted);
        }
      }

      &--bid .quote-item__value { color: #0ecb81; }
      &--ask .quote-item__value { color: #f6465d; }
      &--ts .quote-item__value  { font-size: t.$font-size-sm; }
      &--live { justify-content: flex-end; }
    }

    .live-badge-sm {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      background: rgba(14, 203, 129, 0.15);
      border: 1px solid #0ecb81;
      border-radius: 4px;
      color: #0ecb81;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #0ecb81;
      animation: pulse 1.5s ease-in-out infinite;
    }

    /* ── Swap form ── */
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

    .swap-field {
      flex: 1;
      min-width: 200px;
    }

    .flip-btn {
      color: var(--color-text-secondary);
      transition: transform 0.3s ease;
      &:hover { transform: rotate(180deg); color: var(--color-text-primary); }
    }

    .estimate-box {
      flex: 1;
      min-width: 180px;
      display: flex;
      flex-direction: column;
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

    .estimate-rate {
      font-size: t.$font-size-xs;
      color: var(--color-text-muted);
      margin-top: 4px;
    }

    .slippage-row {
      display: flex;
      align-items: center;
      gap: t.$spacing-md;
      flex-wrap: wrap;
    }

    .field-sm {
      width: 160px;
    }

    .price-info {
      font-size: t.$font-size-sm;
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;

      &--warn {
        color: var(--color-danger, #ef4444);
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #0ecb81;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
    }

    .action-row {
      display: flex;
      align-items: center;
      gap: t.$spacing-md;
    }

    .swap-btn {
      flex: 1;
      height: 48px;
      font-size: t.$font-size-base;
      font-weight: t.$font-weight-semibold;
    }

    .token-suffix {
      font-weight: t.$font-weight-semibold;
      color: var(--color-text-muted);
    }

    /* Trade history table */
    .trade-table-wrap {
      overflow-x: auto;
    }

    .trade-table {
      width: 100%;
      border-collapse: collapse;
      font-size: t.$font-size-sm;

      th, td {
        padding: 8px 12px;
        text-align: left;
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

      td {
        color: var(--color-text-primary);
      }
    }

    .dir-buy {
      color: #0ecb81;
      font-weight: 600;
    }

    .dir-sell {
      color: #f6465d;
      font-weight: 600;
    }
  `],
})
export class DemoAccountPageComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly demoFacade = inject(DemoAccountFacade);
  private readonly quotesFacade = inject(QuotesFacade);
  private readonly subsFacade = inject(SubscriptionsFacade);
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly liveChartSocket = inject(LiveChartSocketService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);

  // Балансы
  usdcBalance = 100;
  wethBalance = 0;
  initialUsdc = 100;
  portfolioValue = 100;
  pnl = 0;
  pnlDisplay = '+0.00 USDC';

  // Swap form
  direction: SwapDirection = 'USDC_TO_WETH';
  amountIn = 100;
  slippagePct = 0.01;
  estimatedOut = 0;
  midPrice = 0;
  bidPrice = 0;
  askPrice = 0;
  spreadPct = 0;
  quoteTimestamp = 0;
  priceSourceLabel = '';
  loading = false;
  wsError = '';

  // Initial balance
  initialUsdcInput = 100;

  // Trade history
  trades: DemoTrade[] = [];

  private rxSubs: RxSubscription[] = [];

  /** Флаг: пара записана как USDC_WETH (нужна инверсия bid/ask) */
  private invertedPair = false;

  get canSwap(): boolean {
    if (this.amountIn <= 0 || this.midPrice <= 0) return false;
    if (this.direction === 'USDC_TO_WETH') return this.amountIn <= this.usdcBalance;
    return this.amountIn <= this.wethBalance;
  }

  ngOnInit(): void {
    // 1. Загружаем каталог + подписки + начальные котировки (для первого отображения)
    this.catalogFacade.loadAll();
    this.subsFacade.load();
    this.quotesFacade.loadLatest();

    // 2. Из начальных котировок получаем первоначальный bid/ask/mid
    const qSub = this.quotesFacade.latestQuotes$.subscribe((quotes) => {
      if (quotes.length > 0 && this.midPrice === 0) {
        this.applySnapshot(quotes);
      }
    });
    this.rxSubs.push(qSub);

    // 3. Когда И подписки И каталог загрузились — ищем Arbitrum DEX WETH/USDC и подключаем WS
    const loadSub = combineLatest([
      this.subsFacade.loading$,
      this.catalogFacade.loading$,
    ]).pipe(
      filter(([subsLoading, catLoading]) => !subsLoading && !catLoading),
      take(1),
    ).subscribe(() => this.findAndConnectArbitrumSub());
    this.rxSubs.push(loadSub);

    // 4. Подписка на состояние демо-аккаунта
    const bSub = combineLatest([
      this.demoFacade.usdcBalance$,
      this.demoFacade.wethBalance$,
      this.demoFacade.initialUsdc$,
      this.demoFacade.tradeHistory$,
      this.demoFacade.loading$,
    ]).subscribe(([usdc, weth, initial, history, loading]) => {
      this.usdcBalance = usdc;
      this.wethBalance = weth;
      this.initialUsdc = initial;
      this.initialUsdcInput = initial;
      this.trades = history;
      this.loading = loading;

      // После свопа: переключаем направление
      if (history.length > 0 && !loading) {
        const lastTrade = history[0];
        if (lastTrade.direction === 'USDC_TO_WETH' && this.direction === 'USDC_TO_WETH') {
          this.direction = 'WETH_TO_USDC';
          this.amountIn = lastTrade.amountOut;
        } else if (lastTrade.direction === 'WETH_TO_USDC' && this.direction === 'WETH_TO_USDC') {
          this.direction = 'USDC_TO_WETH';
          this.amountIn = lastTrade.amountOut;
        }
      }

      this.updatePortfolio();
      this.recalcEstimate();
      this.cdr.markForCheck();
    });
    this.rxSubs.push(bSub);
  }

  ngOnDestroy(): void {
    this.rxSubs.forEach((s) => s.unsubscribe());
    this.liveChartSocket.disconnect();
  }

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
    if (this.midPrice <= 0 || this.amountIn <= 0) {
      this.estimatedOut = 0;
      return;
    }
    const slip = (this.slippagePct ?? 0.01) / 100;
    if (this.direction === 'USDC_TO_WETH') {
      const price = this.askPrice > 0 ? this.askPrice : this.midPrice;
      const effectivePrice = price * (1 + slip);
      this.estimatedOut = this.amountIn / effectivePrice;
    } else {
      const price = this.bidPrice > 0 ? this.bidPrice : this.midPrice;
      const effectivePrice = price * (1 - slip);
      this.estimatedOut = this.amountIn * effectivePrice;
    }
  }

  doSwap(): void {
    if (!this.canSwap) return;
    const slip = (this.slippagePct ?? 0.01) / 100;
    this.demoFacade.swap(this.direction, this.amountIn, slip, this.midPrice);
    this.snackBar.open(
      `Swap executed: ${this.amountIn.toFixed(this.direction === 'USDC_TO_WETH' ? 2 : 6)} ` +
      `${this.direction === 'USDC_TO_WETH' ? 'USDC' : 'WETH'} → ` +
      `≈${this.estimatedOut.toFixed(this.direction === 'USDC_TO_WETH' ? 6 : 2)} ` +
      `${this.direction === 'USDC_TO_WETH' ? 'WETH' : 'USDC'}`,
      'OK',
      { duration: 4000 },
    );
  }

  applyInitialBalance(): void {
    const val = this.initialUsdcInput;
    if (!val || val <= 0) return;
    this.demoFacade.setInitialBalance(val);
    this.direction = 'USDC_TO_WETH';
    this.amountIn = val;
    this.recalcEstimate();
    this.snackBar.open(`Demo account reset to ${val} USDC`, 'OK', { duration: 3000 });
  }

  resetAccount(): void {
    this.demoFacade.reset();
    this.direction = 'USDC_TO_WETH';
    this.amountIn = 100;
    this.recalcEstimate();
    this.snackBar.open('Demo account reset to 100 USDC', 'OK', { duration: 3000 });
  }

  /* ── WebSocket ── */

  /**
   * Ищем подписку на Arbitrum DEX + WETH/USDC среди подписок пользователя.
   * Для определения берём каталог sources/pairs.
   */
  private findAndConnectArbitrumSub(): void {
    const sub = combineLatest([
      this.subsFacade.saved$,
      this.catalogFacade.sources$,
      this.catalogFacade.pairs$,
    ]).pipe(
      filter(([subs, sources, pairs]) => subs.length > 0 && sources.length > 0 && pairs.length > 0),
      take(1),
    ).subscribe(([subs, sources, pairs]) => {
      const sourceMap = new Map(sources.map((s: Source) => [s.id, s]));
      const pairMap = new Map(pairs.map((p: TradingPair) => [p.id, p]));

      // Ищем подписку Arbitrum DEX + WETH/USDC
      const targetSub = subs.find((s: Subscription) => {
        const source = sourceMap.get(s.sourceId);
        const pair = pairMap.get(s.pairId);

        // Матч через каталог
        if (source && pair) {
          const isArbitrum = source.name.toLowerCase().includes('arbitrum') ||
                             source.displayName.toLowerCase().includes('arbitrum');
          const pName = pair.displayName.toUpperCase();
          const isWethUsdc = (pName.includes('WETH') || pName.includes('ETH')) &&
                             (pName.includes('USDC') || pName.includes('USDT'));
          if (isArbitrum && isWethUsdc) return true;
        }

        // Fallback: матч по raw sourceId/pairId
        const sid = s.sourceId.toLowerCase();
        const pid = s.pairId.toUpperCase();
        const isArbRaw = sid.includes('arbitrum');
        const isWethUsdcRaw = (pid.includes('WETH') || pid.includes('ETH')) &&
                              (pid.includes('USDC') || pid.includes('USDT'));
        return isArbRaw && isWethUsdcRaw;
      });

      if (!targetSub) {
        this.wsError = 'No Arbitrum DEX — WETH/USDC subscription found. Add it in Market Catalog.';
        this.cdr.markForCheck();
        return;
      }

      // Определяем порядок пары (нужна ли инверсия)
      const pair = pairMap.get(targetSub.pairId);
      const pidRaw = (pair?.id ?? targetSub.pairId).toUpperCase();
      this.invertedPair = pidRaw.startsWith('USDC') || pidRaw.startsWith('USDT');

      this.priceSourceLabel = 'Arbitrum DEX';
      this.connectWebSocket(targetSub.id);
    });
    this.rxSubs.push(sub);
  }

  private connectWebSocket(subscriptionId: string): void {
    this.store.select(selectAccessToken).pipe(take(1)).subscribe((token) => {
      if (!token) return;

      const wsSub = this.liveChartSocket
        .connect(token, subscriptionId)
        .subscribe({
          next: (msg) => this.onWsMessage(msg),
          error: (err) => {
            console.error('Demo WS error:', err);
            this.wsError = 'WebSocket connection failed. Retrying…';
            this.cdr.markForCheck();
          },
        });
      this.rxSubs.push(wsSub);
    });
  }

  /**
   * Обработка WS-сообщения: обновляет bid или ask в реальном времени.
   * Ключ: "dex:arbitrum|WETH/USDC|bidPrice" или "dex:arbitrum0x.../0x...askPrice"
   */
  private onWsMessage(msg: LiveChartMessage): void {
    const key = msg.key.toLowerCase();
    const isBid = key.endsWith('bidprice');
    const isAsk = key.endsWith('askprice');
    if (!isBid && !isAsk) return;

    const rawValue = msg.point.v;
    this.quoteTimestamp = msg.point.t;

    if (this.invertedPair) {
      // Пара USDC/WETH: значение = цена USDC в WETH, инвертируем
      if (rawValue <= 0) return;
      if (isBid) {
        // bid USDC/WETH → ask WETH/USDC
        this.askPrice = 1 / rawValue;
      } else {
        // ask USDC/WETH → bid WETH/USDC
        this.bidPrice = 1 / rawValue;
      }
    } else {
      if (isBid) {
        this.bidPrice = rawValue;
      } else {
        this.askPrice = rawValue;
      }
    }

    // Пересчитываем mid и spread
    if (this.bidPrice > 0 && this.askPrice > 0) {
      this.midPrice = (this.bidPrice + this.askPrice) / 2;
      this.spreadPct = ((this.askPrice - this.bidPrice) / this.midPrice) * 100;
    } else if (this.bidPrice > 0) {
      this.midPrice = this.bidPrice;
    } else if (this.askPrice > 0) {
      this.midPrice = this.askPrice;
    }

    this.wsError = '';
    this.recalcEstimate();
    this.updatePortfolio();
    this.cdr.markForCheck();
  }

  /* ── Snapshot (начальные котировки) ── */

  /**
   * Применяет начальный snapshot из quotes-стора для первого отображения
   * (пока WS ещё не подключился).
   */
  private applySnapshot(quotes: Quote[]): void {
    const isArbitrum = (sid: string) =>
      sid === 'dex:arbitrum' || sid === 'dex_arbitrum' || sid.toLowerCase().includes('arbitrum');

    const isWethUsdcPair = (pid: string) => {
      const p = pid.toUpperCase();
      return (p.includes('WETH') || p.includes('ETH')) && (p.includes('USDC') || p.includes('USDT'));
    };

    const q = quotes.find(
      (quote) => isArbitrum(quote.sourceId) && isWethUsdcPair(quote.pairId) && quote.mid > 0,
    ) ?? quotes.find(
      (quote) => isWethUsdcPair(quote.pairId) && quote.mid > 0,
    );

    if (!q) return;

    this.priceSourceLabel = isArbitrum(q.sourceId) ? 'Arbitrum DEX' : q.sourceId;
    this.quoteTimestamp = q.timestamp;

    const pid = q.pairId.toUpperCase();
    const inverted = pid.startsWith('USDC') || pid.startsWith('USDT');

    if (inverted) {
      this.midPrice = 1 / q.mid;
      this.bidPrice = q.ask > 0 ? 1 / q.ask : 0;
      this.askPrice = q.bid > 0 ? 1 / q.bid : 0;
    } else {
      this.midPrice = q.mid;
      this.bidPrice = q.bid;
      this.askPrice = q.ask;
    }

    this.spreadPct = this.midPrice > 0
      ? ((this.askPrice - this.bidPrice) / this.midPrice) * 100
      : 0;

    this.recalcEstimate();
    this.updatePortfolio();
    this.cdr.markForCheck();
  }

  private updatePortfolio(): void {
    if (this.midPrice > 0) {
      this.portfolioValue = this.usdcBalance + this.wethBalance * this.midPrice;
    } else {
      this.portfolioValue = this.usdcBalance;
    }
    this.pnl = this.portfolioValue - this.initialUsdc;
    const sign = this.pnl >= 0 ? '+' : '';
    this.pnlDisplay = `${sign}${this.pnl.toFixed(2)} USDC`;
  }
}





