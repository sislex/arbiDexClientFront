import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { buildPoolKey } from '../prices/market-data-keys';

/** Метаданные пула из arbiDexMarketData (значение ключа bidPool/askPool) */
export interface PoolInfo {
  dex: string;
  version: string;
  poolAddress: string;
}

interface StoreKeyResponse {
  key: string;
  value: PoolInfo;
}

/**
 * Прокси к arbiDexMarketData: получает метаданные пула (bidPool/askPool)
 * на стороне сервера, чтобы фронтенд не упирался в CORS.
 */
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly marketDataUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.marketDataUrl = this.configService.getOrThrow<string>('marketData.url');
  }

  /** Получить метаданные пула по sourceId + pairId + стороне (bid/ask). */
  async getPool(
    sourceId: string,
    pairId: string,
    side: 'bid' | 'ask',
  ): Promise<PoolInfo> {
    const key = buildPoolKey(sourceId, pairId, side);
    if (!key) {
      throw new BadRequestException(
        `Невозможно построить ключ пула для sourceId=${sourceId}, pairId=${pairId}`,
      );
    }

    const url = `${this.marketDataUrl}/store/key/${encodeURIComponent(key)}`;

    // Разовая недоступность стора не должна срывать сделку: сигнал стратегии
    // уже пойман, следующий может не повториться. Несколько попыток с паузой.
    const attempts = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get<StoreKeyResponse>(url),
        );
        const value = response.data?.value;
        if (!value || !value.poolAddress) {
          throw new BadRequestException(`Пул не найден для ключа ${key}`);
        }
        return value;
      } catch (error) {
        if (attempt < attempts) {
          this.logger.warn(
            `Пул ${key}: попытка ${attempt}/${attempts} не удалась (${(error as Error).message}) — повтор…`,
          );
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        if (error instanceof BadRequestException) throw error;
        this.logger.error(
          `Не удалось получить данные пула (${url}): ${(error as Error).message}`,
        );
        throw new BadRequestException(
          `Не удалось получить данные пула от arbiDexMarketData (${this.marketDataUrl}).`,
        );
      }
    }
  }

  /** Прокси GET /store/keys → arbiDexMarketData */
  async getStoreKeys(): Promise<string[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<string[]>(`${this.marketDataUrl}/store/keys`),
      );
      return response.data ?? [];
    } catch (error) {
      this.logger.error(`Store keys GET failed: ${(error as Error).message}`);
      throw new BadRequestException(
        `Не удалось получить ключи от arbiDexMarketData (${this.marketDataUrl}).`,
      );
    }
  }

  /** Прокси POST /store/keys → arbiDexMarketData */
  async postStoreKeys(body: { keys: string[]; limit?: number }) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.marketDataUrl}/store/keys`, body),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Store keys POST failed: ${(error as Error).message}`);
      throw new BadRequestException(
        `Не удалось получить серии от arbiDexMarketData (${this.marketDataUrl}).`,
      );
    }
  }
}
