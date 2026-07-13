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

  /** roomId'ы, для которых startRoom уже выполняется (защита от гонки) */
  private readonly pendingRooms = new Set<string>();

  /** socketId → roomId */
  private readonly socketRooms = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Subscription)
    private readonly subsRepo: Repository<Subscription>,
  ) {
    this.marketDataUrl = this.configService.getOrThrow<string>('marketData.url');
  }

  /** Вызывается при подключении клиента */
  async handleConnection(client: Socket): Promise<void> {
    // 1. JWT обязателен — без валидного токена соединение отклоняется
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Клиент ${client.id}: токен не передан, отключаем`);
      client.disconnect();
      return;
    }
    let userId: string;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
      userId = payload.sub;
    } catch {
      this.logger.warn(`Клиент ${client.id}: неверный JWT, отключаем`);
      client.disconnect();
      return;
    }

    // 2. Определяем цель стрима: подписка (старый фронт) ИЛИ рынок source+pair (новый фронт)
    const q = client.handshake.query ?? {};
    const subscriptionId = q.subscriptionId as string | undefined;
    const sourceId = q.sourceId as string | undefined;
    const pairId = q.pairId as string | undefined;

    let roomId: string;
    let streamSource: string;
    let streamPair: string;

    if (subscriptionId) {
      // Проверка владельца подписки (anti-IDOR)
      const sub = await this.subsRepo.findOne({ where: { id: subscriptionId, userId } });
      if (!sub) {
        this.logger.warn(`Клиент ${client.id}: подписка ${subscriptionId} не найдена/чужая, отключаем`);
        client.disconnect();
        return;
      }
      roomId = `subscription:${subscriptionId}`;
      streamSource = sub.sourceId;
      streamPair = sub.pairId;
    } else if (sourceId && pairId) {
      // Стрим по рынку (публичные данные каталога) — без подписки.
      roomId = `market:${sourceId}|${pairId}`;
      streamSource = sourceId;
      streamPair = pairId;
    } else {
      this.logger.warn(`Клиент ${client.id}: не передан subscriptionId или sourceId+pairId, отключаем`);
      client.disconnect();
      return;
    }

    // Добавляем клиента в room
    void client.join(roomId);
    this.socketRooms.set(client.id, roomId);
    this.logger.log(`Клиент ${client.id} вошёл в комнату ${roomId}`);

    // Один upstream на комнату; резервируем pending синхронно до await (защита от гонки)
    if (!this.rooms.has(roomId) && !this.pendingRooms.has(roomId)) {
      this.pendingRooms.add(roomId);
      try {
        await this.startRoom(roomId, streamSource, streamPair);
      } finally {
        this.pendingRooms.delete(roomId);
      }
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
  private async startRoom(roomId: string, sourceId: string, pairId: string): Promise<void> {
    // Определяем формат ключей на сервере
    let format: 'pipe' | 'concat' = 'concat';
    try {
      const resp = await fetch(`${this.marketDataUrl}/store/keys`);
      const allKeys: string[] = await resp.json();
      format = detectKeyFormat(allKeys);
    } catch { /* по умолчанию concat */ }

    // Никаких хардкод-фолбэков: если ключи не собрались — upstream не запускаем
    const keys = buildStoreKeys(sourceId, pairId, format);
    if (!keys) {
      this.logger.warn(
        `Комната ${roomId}: не удалось построить ключи для sourceId="${sourceId}", pairId="${pairId}" — upstream не запущен`,
      );
      return;
    }
    const { bidKey, askKey } = keys;
    this.logger.log(
      `Комната ${roomId}: ключи построены → bid=${bidKey}, ask=${askKey}`,
    );

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
