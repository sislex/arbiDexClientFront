import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { PlaybackState, PlaybackSpeed, PLAYBACK_SPEEDS } from '../../../shared/models';
import { LiveChartMessage } from '../../live-chart/services/live-chart-socket.service';
import { SubscriptionPriceData } from '../../subscriptions/services/prices.service.interface';
import { PricePoint } from '../../../shared/ui/price-chart/price-chart.component';

/**
 * Точка bid/ask, извлечённая из SubscriptionPriceData для воспроизведения.
 * Содержит время и все ценовые поля точки.
 */
interface PlaybackPoint {
  time: number;
  fields: { key: string; value: number }[];
}

/**
 * Сервис исторического воспроизведения: загружает ценовые данные для подписки
 * и проигрывает их с настраиваемой скоростью, эмулируя live-поток.
 */
@Injectable({ providedIn: 'root' })
export class HistoricalPlaybackService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);

  /** Все загруженные точки для последовательного воспроизведения */
  private points: PlaybackPoint[] = [];
  /** Конфиг серий (оригинальный, как пришёл с бэка) */
  private seriesConfigs: SubscriptionPriceData['series'] = [];

  /** Текущий индекс точки */
  private currentIdx = 0;

  /** Текущая скорость */
  private speed: PlaybackSpeed = 1;

  /** ID таймера */
  private timerId: ReturnType<typeof setInterval> | null = null;

  /** Стрим обновлений цен (в формате LiveChartMessage) */
  private priceUpdateSubject = new Subject<LiveChartMessage>();
  readonly priceUpdate$: Observable<LiveChartMessage> = this.priceUpdateSubject.asObservable();

  /** Стрим состояния плеера */
  private stateSubject = new BehaviorSubject<PlaybackState>(this.defaultState());
  readonly state$: Observable<PlaybackState> = this.stateSubject.asObservable();

  /** Текущее состояние */
  get state(): PlaybackState {
    return this.stateSubject.value;
  }

  /** Загрузить исторические данные для подписки */
  async load(subscriptionId: string): Promise<SubscriptionPriceData | null> {
    this.stop();
    this.updateState({ loading: true, error: '' });

    try {
      const data = await firstValueFrom(
        this.http.get<SubscriptionPriceData>(
          `${this.apiUrl}/prices/subscription/${subscriptionId}`,
        ),
      );

      this.seriesConfigs = data.series;
      this.points = this.extractPoints(data);

      if (this.points.length === 0) {
        this.updateState({
          loading: false,
          error: 'Нет исторических данных для этой подписки',
        });
        return data;
      }

      const startTime = this.points[0].time;
      const endTime = this.points[this.points.length - 1].time;

      this.currentIdx = 0;
      this.updateState({
        loading: false,
        isPlaying: false,
        speed: this.speed,
        currentTime: startTime,
        startTime,
        endTime,
        progress: 0,
        totalPoints: this.points.length,
        currentIndex: 0,
        error: '',
      });

      return data;
    } catch (err: any) {
      const msg = err?.error?.message ?? err?.message ?? 'Ошибка загрузки данных';
      this.updateState({ loading: false, error: msg });
      return null;
    }
  }

  /** Начать воспроизведение */
  play(): void {
    if (this.points.length === 0) return;
    if (this.currentIdx >= this.points.length) {
      this.currentIdx = 0;
    }
    this.clearTimer();

    // Базовый интервал тика — 100ms, при скорости 1x эмитим 1 точку за тик
    const TICK_MS = 100;
    this.timerId = setInterval(() => this.tick(), TICK_MS);
    this.updateState({ isPlaying: true });
  }

  /** Пауза */
  pause(): void {
    this.clearTimer();
    this.updateState({ isPlaying: false });
  }

  /** Остановить и сбросить */
  stop(): void {
    this.clearTimer();
    this.currentIdx = 0;
    this.updateState(this.defaultState());
  }

  /** Установить скорость */
  setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed;
    this.updateState({ speed });
    // Если играет — перезапускаем таймер с новой скоростью
    if (this.state.isPlaying) {
      this.clearTimer();
      const TICK_MS = 100;
      this.timerId = setInterval(() => this.tick(), TICK_MS);
    }
  }

  /** Перейти к определённой позиции (0..1) */
  seekTo(progress: number): void {
    if (this.points.length === 0) return;
    const idx = Math.min(
      Math.floor(progress * this.points.length),
      this.points.length - 1,
    );
    this.currentIdx = idx;
    this.emitStateForIndex(idx);
  }

  /** Следующая доступная скорость */
  nextSpeed(): PlaybackSpeed {
    const idx = PLAYBACK_SPEEDS.indexOf(this.speed);
    return PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
  }

  /** Уничтожить сервис */
  destroy(): void {
    this.stop();
    this.priceUpdateSubject.complete();
  }

  /* ── Private ── */

  private tick(): void {
    // Скорость определяет сколько точек за один тик (100ms)
    const pointsPerTick = this.speed;
    let emitted = 0;

    while (emitted < pointsPerTick && this.currentIdx < this.points.length) {
      const pt = this.points[this.currentIdx];

      // Эмитим каждое поле как отдельное LiveChartMessage
      for (const field of pt.fields) {
        this.priceUpdateSubject.next({
          key: field.key,
          point: { t: pt.time, v: field.value },
        });
      }

      this.currentIdx++;
      emitted++;
    }

    this.emitStateForIndex(this.currentIdx - 1);

    // Конец данных
    if (this.currentIdx >= this.points.length) {
      this.clearTimer();
      this.updateState({ isPlaying: false, progress: 1 });
    }
  }

  /**
   * Извлекает точки из SubscriptionPriceData.
   * Каждая точка содержит time + все ценовые поля.
   * Для DEX: bidPrice, askPrice → ключи формата "dex:arbitrum|...|bidPrice"
   * Для CEX: midPrice → синтетический ключ
   */
  private extractPoints(data: SubscriptionPriceData): PlaybackPoint[] {
    return data.data.map((pt: PricePoint) => {
      const fields: { key: string; value: number }[] = [];
      for (const s of data.series) {
        if (pt[s.key] !== undefined && pt[s.key] > 0) {
          // Генерируем ключ, похожий на формат WS-сообщения
          // Серия уже содержит key типа "bidPrice"/"askPrice"/"midPrice"
          // LiveChartMessage.key = "dex:arbitrum|0x.../0x...|bidPrice"
          // Но компонент onWsMessage проверяет только endsWith('bidprice'/'askprice')
          // Для исторического режима используем синтетический ключ
          fields.push({
            key: `playback|${s.key}`,
            value: pt[s.key],
          });
        }
      }
      return { time: pt.time, fields };
    });
  }

  private emitStateForIndex(idx: number): void {
    if (idx < 0 || this.points.length === 0) return;
    const safeIdx = Math.min(idx, this.points.length - 1);
    this.updateState({
      currentTime: this.points[safeIdx].time,
      currentIndex: safeIdx,
      progress: this.points.length > 1 ? safeIdx / (this.points.length - 1) : 1,
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


