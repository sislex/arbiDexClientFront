import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { vi } from 'vitest';
import { LiveTradingService } from './live-trading.service';
import { Bot } from './entities/bot.entity';
import { BotTrade } from './entities/bot-trade.entity';

function makeBot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: 'bot-1',
    userId: 'user-1',
    name: 'Bot',
    status: 'running',
    mode: 'demo-live',
    marketConfigId: 'market-1',
    strategyConfigId: 'strategy-1',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    initialBalance: 1000,
    balance: 1000,
    pnl: 12,
    pnlPct: 1.2,
    tradesCount: 3,
    winRate: 50,
    openPosition: false,
    positionSize: 0,
    entryPrice: 0,
    positionOpenedAt: 0,
    slippagePct: 0.5,
    txInProgressUntil: 0,
    minPositionValue: 0,
    lastSignalAt: 0,
    lastTickAt: 0,
    failCooldownUntil: 0,
    startedAt: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Bot;
}

function makeService() {
  const botsRepo = {
    save: jestFn(async <T>(value: T) => value),
  } as unknown as Repository<Bot>;
  const tradesRepo = {
    delete: jestFn(async () => undefined),
  } as unknown as Repository<BotTrade>;

  const service = new LiveTradingService(
    botsRepo,
    tradesRepo,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { service, botsRepo, tradesRepo };
}

function jestFn<T extends (...args: any[]) => any>(impl?: T) {
  return vi.fn(impl) as unknown as T;
}

describe('LiveTradingService', () => {
  it('resetAccount clears only demo trades and restores the initial demo account', async () => {
    const { service, botsRepo, tradesRepo } = makeService();
    const bot = makeBot({
      balance: 120,
      pnl: -50,
      pnlPct: -5,
      tradesCount: 8,
      winRate: 25,
      openPosition: true,
      positionSize: 0.75,
      entryPrice: 91,
      mode: 'demo-live',
    });
    vi.spyOn(service as any, 'findBot').mockResolvedValue(bot);

    const result = await service.resetAccount('user-1', 'bot-1');

    expect(tradesRepo.delete).toHaveBeenCalledWith({ botId: 'bot-1', mode: 'demo' });
    expect(result.balance).toBe(1000);
    expect(result.positionSize).toBe(0);
    expect(result.entryPrice).toBe(0);
    expect(result.openPosition).toBe(false);
    expect(result.pnl).toBe(0);
    expect(result.pnlPct).toBe(0);
    expect(result.tradesCount).toBe(0);
    expect(result.winRate).toBe(0);
    expect(botsRepo.save).toHaveBeenCalledWith(bot);
  });

  it('rejects demo buy when there is no free quote balance', async () => {
    const { service } = makeService();
    vi.spyOn(service as any, 'findBot').mockResolvedValue(makeBot({ balance: 0 }));

    await expect(service.trade('user-1', 'bot-1', { side: 'buy' })).rejects.toThrow(
      new BadRequestException('Нет свободного баланса для покупки.'),
    );
  });

  it('rejects buy when a position is already open', async () => {
    const { service } = makeService();
    vi.spyOn(service as any, 'findBot').mockResolvedValue(
      makeBot({ balance: 500, openPosition: true, positionSize: 1, entryPrice: 100 }),
    );

    await expect(service.trade('user-1', 'bot-1', { side: 'buy' })).rejects.toThrow(
      new BadRequestException('Позиция уже открыта — сначала продайте её.'),
    );
  });

  it('rejects sell when there is no open position', async () => {
    const { service } = makeService();
    vi.spyOn(service as any, 'findBot').mockResolvedValue(makeBot({ openPosition: false, positionSize: 0 }));

    await expect(service.trade('user-1', 'bot-1', { side: 'sell' })).rejects.toThrow(
      new BadRequestException('Нет открытой позиции — сначала купите.'),
    );
  });
});

