import { PriceSeriesConfig, PricePoint } from '../ui/price-chart/price-chart.component';
import { SubscriptionPriceData } from '../../features/subscriptions/services/prices.service.interface';

/** Палитра цветов для линий графика */
export const LINE_COLORS = [
  '#0ecb81', '#f6465d',
  '#2196f3', '#ff9800',
  '#ab47bc', '#ffeb3b',
  '#00bcd4', '#e91e63',
  '#8bc34a', '#ff5722',
  '#3f51b5', '#cddc39',
];

/** Описание одной подписки для построения мульти-графика */
export interface ChartSubscriptionInfo {
  id: string;
  label: string;
  role?: 'reference' | 'trading';
}

/** Результат построения мульти-графика */
export interface MultiChartResult {
  series: PriceSeriesConfig[];
  data: PricePoint[];
  /** subscriptionId → префикс ключей */
  keyPrefixMap: Map<string, string>;
}

/**
 * Строит объединённый график из нескольких SubscriptionPriceData.
 * Каждая подписка получает уникальный префикс, данные объединяются по timeline с forward-fill.
 */
export function buildMultiChart(
  subs: ChartSubscriptionInfo[],
  pricesMap: Record<string, SubscriptionPriceData>,
): MultiChartResult {
  const allSeries: PriceSeriesConfig[] = [];
  const timeMap = new Map<number, PricePoint>();
  const keyPrefixMap = new Map<string, string>();

  subs.forEach((sub, idx) => {
    const data = pricesMap[sub.id];
    if (!data) return;

    const shortId = sub.id.substring(0, 8);
    const prefix = `sub_${shortId}`;
    keyPrefixMap.set(sub.id, prefix);

    const colorIdx = (idx * 2) % LINE_COLORS.length;

    data.series.forEach((origSeries, seriesIdx) => {
      const newKey = `${prefix}_${origSeries.key}`;
      const isBid = origSeries.key.toLowerCase().includes('bid');
      const roleTag = sub.role === 'trading' ? ' [T]' : '';
      allSeries.push({
        key: newKey,
        name: `${sub.label}${roleTag} ${isBid ? 'Bid' : 'Ask'}`,
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

  const sortedPoints = Array.from(timeMap.values()).sort(
    (a, b) => a.time - b.time,
  );
  const filledData = forwardFill(sortedPoints, allSeries);

  return { series: allSeries, data: filledData, keyPrefixMap };
}

/**
 * Forward-fill: если у точки нет значения для серии,
 * берём предыдущее известное значение.
 */
export function forwardFill(
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

/**
 * Извлекает fieldKey из WS-ключа.
 * pipe-формат: 'source|pair|bidPrice' → 'bidPrice'
 * concat-формат: 'binanceETH/USDTbidPrice' → 'bidPrice'
 */
export function extractFieldKey(wsKey: string): string {
  if (wsKey.includes('|')) {
    return wsKey.split('|').pop() ?? wsKey;
  }
  if (wsKey.endsWith('bidPrice')) return 'bidPrice';
  if (wsKey.endsWith('askPrice')) return 'askPrice';
  return wsKey;
}

