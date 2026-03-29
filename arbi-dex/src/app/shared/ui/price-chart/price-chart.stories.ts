import type { Meta, StoryObj } from '@storybook/angular';
import { PriceChartComponent } from './price-chart.component';
import {
  priceChartStubs_small,
  priceChartStubs_medium,
  priceChartStubs_large,
  priceChartStubs_streaming,
  priceChartStubs_multiExchange,
  priceChartStubs_multiExchangeStreaming,
  twoLineSeries,
  multiExchangeSeries,
} from './price-chart.stubs';

const meta: Meta<PriceChartComponent> = {
  title: 'UI/PriceChart',
  component: PriceChartComponent,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      ...story(),
      template: `
        <div style="width: 100%; height: 600px; background: #0b0e11; padding: 12px; box-sizing: border-box;">
          ${story().template}
        </div>
      `,
    }),
  ],
  argTypes: {
    streaming: { control: 'boolean', description: 'Включить режим стриминга (прогрессивный вывод точек)' },
  },
};

export default meta;
type Story = StoryObj<PriceChartComponent>;

/** Две линии (bid/ask) — малый датасет (~50 точек) */
export const StaticSmall: Story = {
  args: {
    data: priceChartStubs_small,
    series: twoLineSeries,
    streaming: false,
  },
};

/** Две линии (bid/ask) — средний датасет (~300 точек) */
export const StaticMedium: Story = {
  args: {
    data: priceChartStubs_medium,
    series: twoLineSeries,
    streaming: false,
  },
};

/** Две линии (bid/ask) — большой датасет (~1000 точек) */
export const StaticLarge: Story = {
  args: {
    data: priceChartStubs_large,
    series: twoLineSeries,
    streaming: false,
  },
};

/** Две линии — режим стриминга (точки появляются каждые 500 мс) */
export const StreamingMode: Story = {
  args: {
    data: priceChartStubs_streaming,
    series: twoLineSeries,
    streaming: true,
  },
};

/** Пять линий с трёх бирж: Binance bid/ask, Bybit bid/ask, MEX sell */
export const MultiExchange: Story = {
  args: {
    data: priceChartStubs_multiExchange,
    series: multiExchangeSeries,
    streaming: false,
  },
};

/** Пять линий — режим стриминга */
export const MultiExchangeStreaming: Story = {
  args: {
    data: priceChartStubs_multiExchangeStreaming,
    series: multiExchangeSeries,
    streaming: true,
  },
};

/** Несколько бирж — часть линий скрыта через hiddenKeys */
export const MultiExchangeHidden: Story = {
  args: {
    data: priceChartStubs_multiExchange,
    series: multiExchangeSeries,
    hiddenKeys: ['binanceAsk', 'bybitAsk'],
    streaming: false,
  },
};

