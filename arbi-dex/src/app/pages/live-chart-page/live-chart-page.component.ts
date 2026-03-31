import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { take } from 'rxjs/operators';
import { Subscription as RxSubscription } from 'rxjs';
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
import { API_BASE_URL } from '../../core/config/api.config';
import { selectAccessToken } from '../../features/auth/store/auth.selectors';
import {
  LiveChartSocketService,
  LiveChartMessage,
} from '../../features/live-chart/services/live-chart-socket.service';
import { SubscriptionPriceData } from '../../features/subscriptions/services/prices.service.interface';

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
  ],
  template: `
    <app-page-container>
      <app-page-header
        title="Live Chart"
        subtitle="Real-time price updates via WebSocket">
        <div slot="actions">
          <button mat-stroked-button routerLink="/subscriptions">
            <mat-icon>arrow_back</mat-icon> Back to Subscriptions
          </button>
        </div>
      </app-page-header>

      <app-loading-state *ngIf="loading" label="Loading chart data…" />

      <div *ngIf="error" class="error-msg">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error }}</span>
      </div>

      <div *ngIf="!loading && !error" class="chart-wrapper">
        <div class="live-badge">
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
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
    }
  `],
})
export class LiveChartPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly liveChartSocket = inject(LiveChartSocketService);
  private readonly cdr = inject(ChangeDetectorRef);

  subscriptionId = '';
  series: PriceSeriesConfig[] = [];
  chartData: PricePoint[] = [];
  loading = true;
  error = '';

  private wsSubscription?: RxSubscription;

  ngOnInit(): void {
    this.subscriptionId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    // Отписываемся от Observable и закрываем Socket.IO соединение
    this.wsSubscription?.unsubscribe();
    this.liveChartSocket.disconnect();
  }

  private loadInitialData(): void {
    this.loading = true;

    this.http
      .get<SubscriptionPriceData>(
        `${this.apiUrl}/prices/subscription/${this.subscriptionId}`,
      )
      .subscribe({
        next: (data) => {
          this.series = data.series;
          this.chartData = [...data.data];
          this.loading = false;
          this.cdr.markForCheck();
          this.connectSocket();
        },
        error: () => {
          this.loading = false;
          this.error = 'Не удалось загрузить исторические данные';
          this.cdr.markForCheck();
        },
      });
  }

  private connectSocket(): void {
    // Берём токен из NgRx store один раз (take(1))
    this.store
      .select(selectAccessToken)
      .pipe(take(1))
      .subscribe((token) => {
        if (!token) return;

        this.wsSubscription = this.liveChartSocket
          .connect(token, this.subscriptionId)
          .subscribe({
            next: (msg: LiveChartMessage) => this.onPriceUpdate(msg),
            error: (err) => {
              console.error('LiveChart WebSocket error:', err);
            },
          });
      });
  }

  private onPriceUpdate(msg: LiveChartMessage): void {
    // Извлекаем имя поля из ключа: "live:chart|WETH/USDC|bidPrice" → "bidPrice"
    const fieldKey = msg.key.split('|').pop() ?? msg.key;

    // Наследуем все поля предыдущей точки, обновляем только изменившееся поле
    const last = this.chartData[this.chartData.length - 1];
    const newPoint: PricePoint = {
      ...(last ?? {}),
      time: msg.point.t,
      [fieldKey]: msg.point.v,
    };

    // Создаём новый массив, чтобы OnPush-детектор увидел изменение
    this.chartData = [...this.chartData, newPoint];
    this.cdr.markForCheck();
  }
}


