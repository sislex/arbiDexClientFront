import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { UserSettings } from '../settings/entities/user-settings.entity';

// ── Фабрика моков — создаём свежие экземпляры для каждого describe ──────────
function buildMocks() {
  const configMap: Record<string, string> = {
    'jwt.accessSecret': 'test_access_secret',
    'jwt.refreshSecret': 'test_refresh_secret',
    'jwt.accessExpiresIn': '15m',
    'jwt.refreshExpiresIn': '7d',
  };
  return {
    usersRepo: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
    settingsRepo: { create: jest.fn(), save: jest.fn() },
    jwtService: { signAsync: jest.fn(), verify: jest.fn() },
    configService: {
      get: jest.fn((key: string) => configMap[key]),
      getOrThrow: jest.fn((key: string) => configMap[key]),
    },
  };
}

async function buildService(mocks: ReturnType<typeof buildMocks>): Promise<AuthService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getRepositoryToken(User), useValue: mocks.usersRepo },
      { provide: getRepositoryToken(UserSettings), useValue: mocks.settingsRepo },
      { provide: JwtService, useValue: mocks.jwtService },
      { provide: ConfigService, useValue: mocks.configService },
    ],
  }).compile();
  return module.get<AuthService>(AuthService);
}

// ── getNonce ────────────────────────────────────────────────────────────────

describe('AuthService › getNonce', () => {
  let service: AuthService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(async () => {
    mocks = buildMocks();
    service = await buildService(mocks);
  });

  it('должен создать нового пользователя и вернуть nonce', async () => {
    mocks.usersRepo.findOne.mockResolvedValue(null);
    mocks.usersRepo.create.mockReturnValue({ id: 'user-1', walletAddress: '0xabc', nonce: null });
    mocks.usersRepo.save.mockResolvedValue({ id: 'user-1', walletAddress: '0xabc', nonce: 'uuid' });
    mocks.settingsRepo.create.mockReturnValue({ userId: 'user-1' });
    mocks.settingsRepo.save.mockResolvedValue({});

    const result = await service.getNonce({ walletAddress: '0xAbC' });

    expect(typeof result.nonce).toBe('string');
    expect(result.nonce.length).toBeGreaterThan(0);
    expect(mocks.usersRepo.create).toHaveBeenCalled();
    expect(mocks.settingsRepo.create).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('должен обновить nonce для существующего пользователя', async () => {
    const existingUser = { id: 'user-1', walletAddress: '0xabc', nonce: 'old-nonce' };
    mocks.usersRepo.findOne.mockResolvedValue(existingUser);
    mocks.usersRepo.save.mockImplementation((u) => Promise.resolve(u));

    const result = await service.getNonce({ walletAddress: '0xAbC' });

    // Сервис мутирует объект in-place перед сохранением
    expect(existingUser.nonce).not.toBe('old-nonce');
    expect(result.nonce).toBe(existingUser.nonce);
    expect(mocks.settingsRepo.create).not.toHaveBeenCalled();
  });

  it('должен привести адрес к нижнему регистру', async () => {
    mocks.usersRepo.findOne.mockResolvedValue(null);
    mocks.usersRepo.create.mockReturnValue({ id: 'u1', walletAddress: '0xabc123', nonce: null });
    mocks.usersRepo.save.mockResolvedValue({ id: 'u1' });
    mocks.settingsRepo.create.mockReturnValue({});
    mocks.settingsRepo.save.mockResolvedValue({});

    await service.getNonce({ walletAddress: '0xABC123' });

    expect(mocks.usersRepo.findOne).toHaveBeenCalledWith({
      where: { walletAddress: '0xabc123' },
    });
  });
});

// ── verifySignature ─────────────────────────────────────────────────────────

describe('AuthService › verifySignature', () => {
  let service: AuthService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(async () => {
    mocks = buildMocks();
    service = await buildService(mocks);
  });

  it('должен бросить UnauthorizedException если пользователь не найден', async () => {
    mocks.usersRepo.findOne.mockResolvedValue(null);

    await expect(
      service.verifySignature({ walletAddress: '0xabc', signature: '0xsig' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('должен бросить UnauthorizedException если nonce не задан', async () => {
    mocks.usersRepo.findOne.mockResolvedValue({ id: 'u1', walletAddress: '0xabc', nonce: null });

    await expect(
      service.verifySignature({ walletAddress: '0xabc', signature: '0xsig' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('должен бросить BadRequestException при некорректной подписи', async () => {
    mocks.usersRepo.findOne.mockResolvedValue({ id: 'u1', walletAddress: '0xabc', nonce: 'nonce' });

    await expect(
      service.verifySignature({ walletAddress: '0xabc', signature: 'invalid-sig' }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ── refresh ─────────────────────────────────────────────────────────────────

describe('AuthService › refresh', () => {
  let service: AuthService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(async () => {
    // Каждый тест получает полностью независимые моки
    mocks = buildMocks();
    service = await buildService(mocks);
  });

  it('должен бросить UnauthorizedException при недействительном refresh-токене', async () => {
    mocks.jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
  });

  it('должен бросить UnauthorizedException если пользователь не найден', async () => {
    mocks.jwtService.verify.mockReturnValue({ sub: 'user-1', address: '0xabc' });
    mocks.usersRepo.findOne.mockResolvedValue(null);

    await expect(service.refresh('valid-token')).rejects.toThrow(UnauthorizedException);
  });

  it('должен вернуть новую пару токенов', async () => {
    mocks.jwtService.verify.mockReturnValue({ sub: 'user-1', address: '0xabc' });
    mocks.usersRepo.findOne.mockResolvedValue({ id: 'user-1', walletAddress: '0xabc' });
    mocks.jwtService.signAsync
      .mockResolvedValueOnce('new-access-token')
      .mockResolvedValueOnce('new-refresh-token');

    const result = await service.refresh('valid-token');

    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(mocks.jwtService.signAsync).toHaveBeenCalledTimes(2);
  });
});

