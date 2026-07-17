import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Socket } from 'socket.io';
import { AutotuneJobsService } from './autotune-jobs.service';

/**
 * Прогресс фонового автоподбора: клиент подключается к /autotune-progress с
 * JWT и jobId, сервер раз в секунду шлёт снапшот задачи (сколько прогонов
 * сделано + top-500 лучших) событием `progress`; после завершения — финальный
 * снапшот со статусом done/error, и рассылка останавливается.
 */
@WebSocketGateway({
  namespace: '/autotune-progress',
  cors: { origin: '*', credentials: false },
})
export class AutotuneProgressGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AutotuneProgressGateway.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly jobs: AutotuneJobsService,
  ) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;
    const jobId = client.handshake.query?.jobId as string | undefined;
    if (!token || !jobId) {
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

    const send = (): void => {
      try {
        const snap = this.jobs.get(userId, jobId);
        client.emit('progress', snap);
        // Очередь/пауза — живые состояния, рассылку прекращаем только на финале.
        if (snap.status === 'done' || snap.status === 'error') this.stop(client.id);
      } catch {
        // Задача не найдена/чужая — сообщаем и закрываем.
        client.emit('progress', { jobId, status: 'error', error: 'Задача автоподбора не найдена' });
        this.stop(client.id);
        client.disconnect();
      }
    };

    send(); // мгновенный первый снапшот
    this.timers.set(client.id, setInterval(send, 1000));
  }

  handleDisconnect(client: Socket): void {
    this.stop(client.id);
  }

  private stop(socketId: string): void {
    const t = this.timers.get(socketId);
    if (t) {
      clearInterval(t);
      this.timers.delete(socketId);
    }
  }
}
