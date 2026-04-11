import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, firstValueFrom, forkJoin } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { PlaybackState, PlaybackSpeed, PLAYBACK_SPEEDS } from '../../../shared/models';
import { SubscriptionPriceData } from '../../subscriptions/services/prices.service.interface';
import {
  PricePoint,
  PriceSeriesConfig,
} from '../../../shared/ui/price-chart/price-chart.component';
import {
  buildMultiChart,
  ChartSubscriptionInfo,
  MultiChartResult,
} from '../../../shared/utils/multi-chart-builder';

/** Сообщение от мульти-плейбека — аналог MultiLiveChartMessage */
export interface MultiPlaybackMessage {
  subscriptionId: string;
  key: string;
  point: { t: number; v: number };
}

/** Агрегированный тик: текущие bid/ask/mid для каждой подписки */
export interface MultiPlaybackTick {
  time: number;
  /** subscriptionId → { bid, ask, mid } */
  values: Map<string, { bid: number; ask: number; mid: number }>;
}

/**
 * Мульти-подписочный playback-сервис для страницы ArbiConfig.
 * Загружает исторические данные для нескольких подписок, объединяет timeline
 * и проигрывает их с настраиваемой скоростью.
 */
@Injectable({ providedIn: 'root' })
export class MultiPlaybackService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);

  /** Объединённые точки для последовательного воспроизведения */
  private mergedPoints: PricePoint[] = [];
  /** Конфиг серий */
  private seriesConfigs: PriceSeriesConfig[] = [];
  /** Маппинг subscriptionId → prefix */
  private keyPrefixMap = new Map<string, string>();
  /** Все subscriptionId'ы */
  private subscriptionIds: string[] = [];

  private currentIdx = 0;
  private speed: PlaybackSpeed = 1;
  private timerId: ReturnType<typeof setInterval> | null = null;

  /** Стрим обновлений цен */
  private tickSubject = new Subject<MultiPlaybackTick>();
  readonly tick$: Observable<MultiPlaybackTick> = this.tickSubject.asObservable();

  /** Стрим состояния плеера */
  private stateSubject = new BehaviorSubject<PlaybackState>(this.defaultState());
  readonly state$: Observable<PlaybackState> = this.stateSubject.asObservable();
  get state(): PlaybackState { return this.stateSubject.value; }

  /** Результат последней загрузки (серии + данные для графика) */
  get chartSeries(): PriceSeriesConfig[] { return this.seriesConfigs; }
  get allPoints(): PricePoint[] { return this.mergedPoints; }

  /**
   * Загрузить из предзагруженных данных (уже полученных через /api/arbi-configs/:id/prices).
   * Гарантирует что playback использует те же данные, что и historical режим.
   */
  loadFromData(
    subs: ChartSubscriptionInfo[],
    pricesMap: Record<string, SubscriptionPriceData>,
  ): MultiChartResult | null {
    this.stop();
    this.subscriptionIds = subs.map(s => s.id);

    const result = buildMultiChart(subs, pricesMap);
    this.seriesConfigs = result.series;
    this.mergedPoints = result.data;
    this.keyPrefixMap = result.keyPrefixMap;

    if (this.mergedPoints.length === 0) {
      this.updateState({ ...this.defaultState(), error: 'Нет исторических данных' });
      return result;
    }

    const startTime = this.mergedPoints[0].time;
    const endTime = this.mergedPoints[this.mergedPoints.length - 1].time;

    this.currentIdx = 0;
    this.updateState({
      loading: false,
      isPlaying: false,
      speed: this.speed,
      currentTime: startTime,
      startTime,
      endTime,
      progress: 0,
      totalPoints: this.mergedPoints.length,
      currentIndex: 0,
      error: '',
    });

    return result;
  }

  /**
   * Загрузить исторические данные для всех подписок конфига (через HTTP).
   * @param subs — описания подписок (id, label, role)
   */
  async load(subs: ChartSubscriptionInfo[]): Promise<MultiChartResult | null> {
    this.stop();
    this.updateState({ loading: true, error: '' });

    try {
      this.subscriptionIds = subs.map(s => s.id);

      // Загружаем все подписки параллельно
      const requests: Record<string, Observable<SubscriptionPriceData>> = {};
      for (const sub of subs) {
        requests[sub.id] = this.http.get<SubscriptionPriceData>(
          `${this.apiUrl}/prices/subscription/${sub.id}`,
        );
      }

      const responses = await firstValueFrom(forkJoin(requests));

      // Строим объединённый график
      const result = buildMultiChart(subs, responses);
      this.seriesConfigs = result.series;
      this.mergedPoints = result.data;
      this.keyPrefixMap = result.keyPrefixMap;

      if (this.mergedPoints.length === 0) {
        this.updateState({ loading: false, error: 'Нет исторических данных' });
        return result;
      }

      const startTime = this.mergedPoints[0].time;
      const endTime = this.mergedPoints[this.mergedPoints.length - 1].time;

      this.currentIdx = 0;
      this.updateState({
        loading: false,
        isPlaying: false,
        speed: this.speed,
        currentTime: startTime,
        startTime,
        endTime,
        progress: 0,
        totalPoints: this.mergedPoints.length,
        currentIndex: 0,
        error: '',
      });

      return result;
    } catch (err: any) {
      const msg = err?.error?.message ?? err?.message ?? 'Ошибка загрузки данных';
      this.updateState({ loading: false, error: msg });
      return null;
    }
  }

  play(): void {
    if (this.mergedPoints.length === 0) return;
    if (this.currentIdx >= this.mergedPoints.length) {
      this.currentIdx = 0;
    }
    this.clearTimer();
    const TICK_MS = 100;
    this.timerId = setInterval(() => this.tickFn(), TICK_MS);
    this.updateState({ isPlaying: true });
  }

  pause(): void {
    this.clearTimer();
    this.updateState({ isPlaying: false });
  }

  stop(): void {
    this.clearTimer();
    this.currentIdx = 0;
    this.updateState(this.defaultState());
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed;
    this.updateState({ speed });
    if (this.state.isPlaying) {
      this.clearTimer();
      const TICK_MS = 100;
      this.timerId = setInterval(() => this.tickFn(), TICK_MS);
    }
  }

  seekTo(progress: number): void {
    if (this.mergedPoints.length === 0) return;
    const idx = Math.min(
      Math.floor(progress * this.mergedPoints.length),
      this.mergedPoints.length - 1,
    );
    this.currentIdx = idx;
    this.emitStateForIndex(idx);
    // Эмитим tick для текущей точки
    this.emitTickForPoint(this.mergedPoints[idx]);
  }

  destroy(): void {
    this.stop();
    this.tickSubject.complete();
  }

  /* ── Private ── */

  private tickFn(): void {
    const pointsPerTick = this.speed;
    let emitted = 0;

    while (emitted < pointsPerTick && this.currentIdx < this.mergedPoints.length) {
      const pt = this.mergedPoints[this.currentIdx];
      this.emitTickForPoint(pt);
      this.currentIdx++;
      emitted++;
    }

    this.emitStateForIndex(this.currentIdx - 1);

    if (this.currentIdx >= this.mergedPoints.length) {
      this.clearTimer();
      this.updateState({ isPlaying: false, progress: 1 });
    }
  }

  /**
   * Из объединённой PricePoint извлекает bid/ask/mid для каждой подписки
   * и эмитит агрегированный MultiPlaybackTick.
   */
  private emitTickForPoint(pt: PricePoint): void {
    const values = new Map<string, { bid: number; ask: number; mid: number }>();

    for (const [subId, prefix] of this.keyPrefixMap.entries()) {
      const bidKey = `${prefix}_bidPrice`;
      const askKey = `${prefix}_askPrice`;
      const midKey = `${prefix}_midPrice`;

      const bid = pt[bidKey] ?? 0;
      const ask = pt[askKey] ?? 0;
      let mid = pt[midKey] ?? 0;

      // Если нет явного mid, вычисляем из bid/ask
      if (mid === 0 && bid > 0 && ask > 0) {
        mid = (bid + ask) / 2;
      } else if (mid === 0 && bid > 0) {
        mid = bid;
      } else if (mid === 0 && ask > 0) {
        mid = ask;
      }

      values.set(subId, { bid, ask, mid });
    }

    this.tickSubject.next({ time: pt.time, values });
  }

  private emitStateForIndex(idx: number): void {
    if (idx < 0 || this.mergedPoints.length === 0) return;
    const safeIdx = Math.min(idx, this.mergedPoints.length - 1);
    this.updateState({
      currentTime: this.mergedPoints[safeIdx].time,
      currentIndex: safeIdx,
      progress: this.mergedPoints.length > 1 ? safeIdx / (this.mergedPoints.length - 1) : 1,
    });
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private updateState(partial: Partial<PlaybackState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }

  private defaultState(): PlaybackState {
    return {
      isPlaying: false,
      speed: 1,
      currentTime: 0,
      startTime: 0,
      endTime: 0,
      progress: 0,
      totalPoints: 0,
      currentIndex: 0,
      loading: false,
      error: '',
    };
  }
}


