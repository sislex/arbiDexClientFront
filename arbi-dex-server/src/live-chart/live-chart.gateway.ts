import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Namespace, Socket } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { buildStoreKeys, detectKeyFormat } from '../prices/market-data-keys';

/** Сообщение dataChange от arbiDexMarketData */
interface DataChangeMessage {
  key: string;
  point: { t: number; v: number };
}

/** Состояние одной комнаты — подключение к arbiDexMarketData */
interface RoomState {
  /** Socket.IO клиент к arbiDexMarketData /store namespace */
  upstreamSocket: ClientSocket;
  /** Ключи, на которые подписана комната */
  bidKey: string;
  askKey: string;
}

/**
 * Socket.IO Gateway для live-chart.
 *
 * Клиент подключается к namespace /live-chart, передавая:
 *   - handshake.auth.token  — JWT access-токен
 *   - handshake.query.subscriptionId — UUID подписки
 *
 * Сервер помещает клиента в room "subscription:<id>" и
 * подключается к arbiDexMarketData /store для получения
 * реальных ценовых обновлений, которые ретранслирует клиентам.
 */
@WebSocketGateway({
  namespace: '/live-chart',
  cors: {
    origin: '*',
    credentials: false,
  },
})
export class LiveChartGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Namespace;

  private readonly logger = new Logger(LiveChartGateway.name);

  /** URL сервиса arbiDexMarketData */
  private readonly marketDataUrl: string;

  /** roomId → состояние подключения к upstream */
  private readonly rooms = new Map<string, RoomState>();

  /** socketId → roomId */
  private readonly socketRooms = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Subscription)
    private readonly subsRepo: Repository<Subscription>,
  ) {
    this.marketDataUrl =
      this.configService.get<string>('marketData.url') ?? 'http://45.135.182.251:3002';
  }

  /** Вызывается при подключении клиента */
  async handleConnection(client: Socket): Promise<void> {
    // 1. Верификация JWT
    const token = client.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        this.jwtService.verify(token, {
          secret: this.configService.get<string>('jwt.accessSecret'),
        });
      } catch {
        this.logger.warn(`Клиент ${client.id}: неверный JWT, отключаем`);
        client.disconnect();
        return;
      }
    }

    // 2. Получаем subscriptionId из query-параметров
    const subscriptionId = client.handshake.query?.subscriptionId as
      | string
      | undefined;
    if (!subscriptionId) {
      this.logger.warn(
        `Клиент ${client.id}: subscriptionId не передан, отключаем`,
      );
      client.disconnect();
      return;
    }

    const roomId = `subscription:${subscriptionId}`;

    // 3. Добавляем клиента в room
    void client.join(roomId);
    this.socketRooms.set(client.id, roomId);
    this.logger.log(`Клиент ${client.id} вошёл в комнату ${roomId}`);

    // 4. Если upstream-подключение для room ещё не создано — создаём
    if (!this.rooms.has(roomId)) {
      await this.startRoom(roomId, subscriptionId);
    }
  }

  /** Вызывается при отключении клиента */
  handleDisconnect(client: Socket): void {
    const roomId = this.socketRooms.get(client.id);
    if (!roomId) return;

    this.socketRooms.delete(client.id);
    this.logger.log(`Клиент ${client.id} покинул комнату ${roomId}`);

    // Проверяем, остались ли ещё клиенты в комнате
    const room = this.server.adapter.rooms?.get(roomId);
    if (!room || room.size === 0) {
      this.stopRoom(roomId);
    }
  }

  /**
   * Подключается к arbiDexMarketData Socket.IO /store namespace
   * и подписывается на ключи bid/ask для данной подписки.
   */
  private async startRoom(
    roomId: string,
    subscriptionId: string,
  ): Promise<void> {
    // Получаем подписку из БД для определения реальных ключей
    const sub = await this.subsRepo.findOne({
      where: { id: subscriptionId },
    });

    let bidKey = 'dex:arbitrumWETHUSdCbidPrice';
    let askKey = 'dex:arbitrumWETHUSDCaskPrice';

    if (sub) {
      // Определяем формат ключей на сервере
      let format: 'pipe' | 'concat' = 'concat';
      try {
        const resp = await fetch(`${this.marketDataUrl}/store/keys`);
        const allKeys: string[] = await resp.json();
        format = detectKeyFormat(allKeys);
      } catch { /* fallback */ }

      const keys = buildStoreKeys(sub.sourceId, sub.pairId, format);
      if (keys) {
        bidKey = keys.bidKey;
        askKey = keys.askKey;
        this.logger.log(
          `Комната ${roomId}: ключи построены → bid=${bidKey}, ask=${askKey}`,
        );
      } else {
        this.logger.warn(
          `Комната ${roomId}: не удалось построить ключи для sourceId="${sub.sourceId}", pairId="${sub.pairId}", используем fallback`,
        );
      }
    } else {
      this.logger.warn(
        `Комната ${roomId}: подписка не найдена, используем fallback-ключи`,
      );
    }

    // Подключаемся к arbiDexMarketData Socket.IO /store namespace
    const upstreamSocket = ioClient(`${this.marketDataUrl}/store`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    upstreamSocket.on('connect', () => {
      this.logger.log(
        `Комната ${roomId}: подключено к arbiDexMarketData /store (${upstreamSocket.id})`,
      );

      // Подписываемся на нужные ключи
      upstreamSocket.emit('subscribe', { keys: [bidKey, askKey] });
    });

    upstreamSocket.on('subscribed', (info: { keys: string[] | 'all' }) => {
      this.logger.log(
        `Комната ${roomId}: подписка на ключи подтверждена: ${JSON.stringify(info.keys)}`,
      );
    });

    // Ретрансляция dataChange → priceUpdate
    upstreamSocket.on('dataChange', (msg: DataChangeMessage) => {
      this.server.to(roomId).emit('priceUpdate', {
        key: msg.key,
        point: msg.point,
      });
    });

    upstreamSocket.on('connect_error', (err: Error) => {
      this.logger.error(
        `Комната ${roomId}: ошибка подключения к arbiDexMarketData — ${err.message}`,
      );
    });

    upstreamSocket.on('disconnect', (reason: string) => {
      this.logger.warn(
        `Комната ${roomId}: upstream отключён — ${reason}`,
      );
    });

    const state: RoomState = {
      upstreamSocket,
      bidKey,
      askKey,
    };

    this.rooms.set(roomId, state);
    this.logger.log(`Запущен upstream для комнаты ${roomId}`);
  }

  /** Останавливает upstream-подключение для комнаты */
  private stopRoom(roomId: string): void {
    const state = this.rooms.get(roomId);
    if (state) {
      // Отписываемся и отключаемся от arbiDexMarketData
      state.upstreamSocket.emit('unsubscribe');
      state.upstreamSocket.disconnect();
      this.rooms.delete(roomId);
      this.logger.log(
        `Upstream для комнаты ${roomId} остановлен (нет клиентов)`,
      );
    }
  }
}
