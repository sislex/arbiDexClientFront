import { Inject, Injectable } from '@angular/core';
import { Observable, merge } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../../../core/config/api.config';

/** Формат одного сообщения от live-chart gateway */
export interface LiveChartMessage {
  /** Ключ серии, например: "dex:arbitrum|WETH/USDC|bidPrice" */
  key: string;
  /** Ценовая точка: timestamp + значение */
  point: { t: number; v: number };
}

/** Сообщение с привязкой к конкретной подписке */
export interface MultiLiveChartMessage extends LiveChartMessage {
  subscriptionId: string;
}

/**
 * Сервис для работы с Socket.IO live-chart namespace.
 * Подключается к /live-chart на сервере, передаёт JWT и subscriptionId,
 * получает live-обновления цен.
 */
@Injectable({ providedIn: 'root' })
export class LiveChartSocketService {
  private socket: Socket | null = null;

  /** Map сокетов для мульти-подписочного режима */
  private sockets = new Map<string, Socket>();

  /** Базовый URL WebSocket-сервера (без /api prefix) */
  private readonly wsUrl: string;

  constructor(@Inject(API_BASE_URL) apiBaseUrl: string) {
    // Убираем /api суффикс, чтобы получить базовый URL сервера для WebSocket
    this.wsUrl = apiBaseUrl.replace(/\/api\/?$/, '');
  }

  /**
   * Подключиться к Gateway и вернуть Observable с входящими сообщениями.
   * При ансабскрайбе от Observable соединение НЕ закрывается автоматически —
   * для закрытия нужно вызвать disconnect() явно (в ngOnDestroy).
   *
   * @param token    JWT access token
   * @param subscriptionId  UUID подписки
   */
  connect(token: string, subscriptionId: string): Observable<LiveChartMessage> {
    this.disconnect();

    this.socket = io(`${this.wsUrl}/live-chart`, {
      auth: { token },
      query: { subscriptionId },
      transports: ['websocket'],
    });

    return new Observable<LiveChartMessage>((observer) => {
      const socket = this.socket!;

      const onPriceUpdate = (msg: LiveChartMessage) => observer.next(msg);
      const onConnectError = (err: Error) => observer.error(err);

      socket.on('priceUpdate', onPriceUpdate);
      socket.on('connect_error', onConnectError);

      // Teardown: снимаем слушатели при ансабскрайбе
      return () => {
        socket.off('priceUpdate', onPriceUpdate);
        socket.off('connect_error', onConnectError);
      };
    });
  }

  /**
   * Подключиться к нескольким подпискам одновременно.
   * Создаёт отдельное Socket.IO-соединение на каждый subscriptionId,
   * объединяет потоки в один Observable с идентификатором подписки.
   *
   * @param token             JWT access token
   * @param subscriptionIds   массив UUID подписок
   */
  connectMultiple(
    token: string,
    subscriptionIds: string[],
  ): Observable<MultiLiveChartMessage> {
    this.disconnectAll();

    const streams = subscriptionIds.map((subId) => {
      const socket = io(`${this.wsUrl}/live-chart`, {
        auth: { token },
        query: { subscriptionId: subId },
        transports: ['websocket'],
      });
      this.sockets.set(subId, socket);

      return new Observable<MultiLiveChartMessage>((observer) => {
        const onPriceUpdate = (msg: LiveChartMessage) =>
          observer.next({ ...msg, subscriptionId: subId });
        const onConnectError = (err: Error) => observer.error(err);

        socket.on('priceUpdate', onPriceUpdate);
        socket.on('connect_error', onConnectError);

        return () => {
          socket.off('priceUpdate', onPriceUpdate);
          socket.off('connect_error', onConnectError);
        };
      });
    });

    return merge(...streams);
  }

  /** Отключиться от Socket.IO и освободить ресурсы (одиночный режим) */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /** Отключить все мульти-соединения */
  disconnectAll(): void {
    this.disconnect();
    this.sockets.forEach((s) => s.disconnect());
    this.sockets.clear();
  }
}

