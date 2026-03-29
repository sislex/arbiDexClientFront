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

  options: AgCartesianChartOptions = {};

  private chartData: PricePoint[] = [];
  private streamIndex = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  /** Полный конфиг без данных — перестраивается только при изменении series/hiddenKeys/streaming */
  private baseOptions: AgCartesianChartOptions = {};

  ngOnInit(): void {
    this.rebuildBaseOptions();
    this.initChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const structureChanged =
      changes['series'] || changes['hiddenKeys'] || changes['streaming'];

    if (structureChanged) {
      this.rebuildBaseOptions();
      this.initChart();
    } else if (changes['data']) {
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
    const seriesDefs = this.series
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
   * Лёгкое обновление — только подменяет данные в существующем конфиге.
   * Создаёт новую ссылку на options, чтобы ag-charts подхватил изменение.
   */
  private applyData(): void {
    this.options = { ...this.baseOptions, data: [...this.chartData] };
  }
}


