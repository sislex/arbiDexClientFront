import { Observable } from 'rxjs';
import { PriceSeriesConfig, PricePoint } from '../../../shared/ui/price-chart/price-chart.component';

/** Ответ от сервера с ценовыми данными подписки */
export interface SubscriptionPriceData {
  series: PriceSeriesConfig[];
  data: PricePoint[];
}

/**
 * Абстрактный сервис получения ценовых данных по подписке.
 */
export abstract class IPricesService {
  abstract getPricesBySubscription(subscriptionId: string): Observable<SubscriptionPriceData>;
}

