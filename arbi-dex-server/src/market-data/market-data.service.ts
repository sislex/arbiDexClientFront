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
    this.marketDataUrl =
      this.configService.get<string>('marketData.url') ?? 'http://45.135.182.251:3002';
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
