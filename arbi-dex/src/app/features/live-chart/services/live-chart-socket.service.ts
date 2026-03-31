import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

/** Формат одного сообщения от live-chart gateway */
export interface LiveChartMessage {
  /** Ключ серии, например: "dex:arbitrum|WETH/USDC|bidPrice" */
  key: string;
  /** Ценовая точка: timestamp + значение */
  point: { t: number; v: number };
}

/**
 * Сервис для работы с Socket.IO live-chart namespace.
 * Подключается к /live-chart на сервере, передаёт JWT и subscriptionId,
 * получает live-обновления цен.
 */
@Injectable({ providedIn: 'root' })
export class LiveChartSocketService {
  private socket: Socket | null = null;

  /** Базовый URL WebSocket-сервера (без /api prefix) */
  private readonly wsUrl = 'http://localhost:3002';

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

  /** Отключиться от Socket.IO и освободить ресурсы */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

