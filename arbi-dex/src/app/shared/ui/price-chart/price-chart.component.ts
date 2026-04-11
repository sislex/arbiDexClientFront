import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { AgCharts } from 'ag-charts-angular';
import { ModuleRegistry, AllCommunityModule } from 'ag-charts-community';
import { AllEnterpriseModule } from 'ag-charts-enterprise';
import type { AgCartesianChartOptions } from 'ag-charts-community';

ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

/** Описание одной линии на графике */
export interface PriceSeriesConfig {
  /** Имя поля в объектах данных, например 'binanceBid' */
  key: string;
  /** Отображаемое название в легенде / тултипе, например 'Binance Bid' */
  name: string;
  /** Цвет линии, например '#0ecb81' */
  color: string;
}

/** Одна точка данных — `time` + произвольные ценовые поля, соответствующие PriceSeriesConfig.key */
export interface PricePoint {
  time: number;
  [key: string]: number;
}

/** Горизонтальная линия-аннотация на графике */
export interface HorizontalLine {
  /** Значение по оси Y */
  value: number;
  /** Цвет линии */
  color: string;
  /** Подпись */
  label: string;
  /** Пунктирная линия (по умолчанию true) */
  dash?: boolean;
}

/** Маркер сделки (покупка/продажа) на графике */
export interface TradeMarker {
  /** Timestamp сделки (ось X) */
  time: number;
  /** Цена сделки (ось Y) */
  price: number;
  /** Направление: buy или sell */
  direction: 'buy' | 'sell';
  /** Опциональная подпись */
  label?: string;
}

@Component({
  selector: 'app-price-chart',
  standalone: true,
  imports: [AgCharts],
  template: `
    <div class="price-chart-wrapper">
      <ag-charts [options]="options"></ag-charts>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .price-chart-wrapper {
      width: 100%;
      height: 100%;
      min-height: 400px;
      background: #161a25;
      border-radius: 4px;
      overflow: hidden;

      ag-charts {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 400px;
      }
    }
  `],
})
export class PriceChartComponent implements OnInit, OnChanges, OnDestroy {
  @Input() data: PricePoint[] = [];
  @Input() series: PriceSeriesConfig[] = [];
  @Input() hiddenKeys: string[] = [];
  @Input() streaming = false;
  @Input() horizontalLines: HorizontalLine[] = [];
  @Input() tradeMarkers: TradeMarker[] = [];

  options: AgCartesianChartOptions = {};

  private chartData: PricePoint[] = [];
  private streamIndex = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  /** Полный конфиг без данных — перестраивается только при изменении series/hiddenKeys/streaming/horizontalLines */
  private baseOptions: AgCartesianChartOptions = {};

  ngOnInit(): void {
    this.rebuildBaseOptions();
    this.initChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const structureChanged =
      changes['series'] || changes['hiddenKeys'] || changes['streaming'] || changes['horizontalLines'];

    if (structureChanged) {
      this.rebuildBaseOptions();
      this.initChart();
    } else if (changes['data'] || changes['tradeMarkers']) {
      // Быстрый путь — изменились только данные, конфиг не перестраиваем
      if (this.streaming) {
        // В режиме стриминга initChart управляет собственным потоком; перезапускаем
        this.initChart();
      } else {
        this.chartData = [...this.data];
        this.applyData();
      }
    }
  }

  ngOnDestroy(): void {
    this.clearStreamInterval();
  }

  /* ── стриминг ── */

  private initChart(): void {
    this.clearStreamInterval();

    if (this.streaming && this.data.length > 0) {
      this.chartData = [];
      this.streamIndex = 0;
      this.applyData();
      this.intervalId = setInterval(() => this.tick(), 500);
    } else {
      this.chartData = [...this.data];
      this.applyData();
    }
  }

  private tick(): void {
    if (this.streamIndex < this.data.length) {
      this.chartData = [...this.chartData, this.data[this.streamIndex]];
      this.streamIndex++;
      this.applyData();
    } else {
      this.clearStreamInterval();
    }
  }

  private clearStreamInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /* ── управление опциями ── */

  /**
   * Перестраивает всё КРОМЕ данных — серии, оси, легенду, зум, навигатор.
   * Вызывается только при изменении series / hiddenKeys / streaming.
   */
  private rebuildBaseOptions(): void {
    const hidden = new Set(this.hiddenKeys);
    const seriesDefs: any[] = this.series
      .filter((s) => !hidden.has(s.key))
      .map((s) => ({
        type: 'line' as const,
        xKey: 'time',
        yKey: s.key,
        yName: s.name,
        stroke: s.color,
        strokeWidth: 2,
        interpolation: { type: 'step' as const, position: 'end' as const },
        marker: { enabled: false },
        tooltip: {
          renderer: (params: any) => ({
            title: s.name,
            content: `${Number(params.datum[params.yKey]).toFixed(4)}`,
          }),
        },
      }));

    // Scatter-серии для маркеров НЕ добавляем в baseOptions —
    // они добавляются динамически в applyData() с собственным массивом data

    this.baseOptions = {
      background: { fill: '#161a25' },
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
      height: 500,
      series: seriesDefs,
      axes: {
        x: {
          type: 'number',
          position: 'bottom',
          label: {
            color: '#848e9c',
            formatter: (params: any) => {
              const d = new Date(params.value);
              return `${d.getHours().toString().padStart(2, '0')}:${d
                .getMinutes()
                .toString()
                .padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
            },
          },
          gridLine: { style: [{ stroke: '#2b3139', lineDash: [4, 4] }] },
          line: { stroke: '#2b3139' },
          crosshair: { enabled: true, stroke: '#848e9c', lineDash: [4, 4] },
        },
        y: {
          type: 'number',
          position: 'right',
          label: { color: '#848e9c' },
          gridLine: { style: [{ stroke: '#2b3139', lineDash: [4, 4] }] },
          line: { stroke: '#2b3139' },
          crosshair: { enabled: true, stroke: '#848e9c', lineDash: [4, 4] },
          crossLines: this.horizontalLines
            .filter((hl) => hl.value > 0)
            .map((hl) => ({
              type: 'line' as const,
              value: hl.value,
              stroke: hl.color,
              strokeWidth: 1.5,
              lineDash: hl.dash !== false ? [6, 4] : undefined,
              label: {
                text: `${hl.label}: ${hl.value.toFixed(2)}`,
                position: 'right' as const,
                color: hl.color,
                fontSize: 10,
              },
            })),
        },
      },
      legend: {
        position: 'top',
        item: { label: { color: '#eaecef' } },
      },
      zoom: {
        enabled: true,
        axes: 'x',
        scrollingStep: 0.3,
      },
      navigator: {
        enabled: true,
        height: 30,
      },
    };
  }

  /**
   * Лёгкое обновление — подменяет данные в существующем конфиге.
   * Если есть tradeMarkers, добавляет scatter-серии с собственными массивами data
   * (не инжектирует в основные данные — это предотвращает stack overflow в AG Charts).
   */
  private applyData(): void {
    const data = [...this.chartData];

    // Собираем серии: начинаем с базовых (line), затем добавляем scatter если есть маркеры
    const seriesDefs: any[] = [...(this.baseOptions.series ?? [])];

    if (this.tradeMarkers.length > 0) {
      const buyData = this.tradeMarkers
        .filter((m) => m.direction === 'buy')
        .map((m) => ({ time: m.time, price: m.price }));
      const sellData = this.tradeMarkers
        .filter((m) => m.direction === 'sell')
        .map((m) => ({ time: m.time, price: m.price }));

      if (buyData.length > 0) {
        seriesDefs.push({
          type: 'scatter' as const,
          xKey: 'time',
          yKey: 'price',
          yName: '🟢 Buy',
          data: buyData,
          marker: {
            shape: 'triangle',
            size: 14,
            fill: '#0ecb81',
            stroke: '#fff',
            strokeWidth: 1.5,
          },
          tooltip: {
            renderer: (params: any) => ({
              title: '🟢 Buy',
              content: `Price: ${Number(params.datum.price).toFixed(4)}`,
            }),
          },
        });
      }

      if (sellData.length > 0) {
        seriesDefs.push({
          type: 'scatter' as const,
          xKey: 'time',
          yKey: 'price',
          yName: '🔴 Sell',
          data: sellData,
          marker: {
            shape: 'diamond',
            size: 14,
            fill: '#f6465d',
            stroke: '#fff',
            strokeWidth: 1.5,
          },
          tooltip: {
            renderer: (params: any) => ({
              title: '🔴 Sell',
              content: `Price: ${Number(params.datum.price).toFixed(4)}`,
            }),
          },
        });
      }
    }

    this.options = { ...this.baseOptions, series: seriesDefs, data };
  }
}


