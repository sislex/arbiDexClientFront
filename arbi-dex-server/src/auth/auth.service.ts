import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/entities/user.entity';
import { UserSettings } from '../settings/entities/user-settings.entity';
import { GetNonceDto } from './dto/get-nonce.dto';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Шаг 1: выдать nonce для подписи */
  async getNonce(dto: GetNonceDto): Promise<{ nonce: string }> {
    const address = dto.walletAddress.toLowerCase();
    let user = await this.usersRepo.findOne({ where: { walletAddress: address } });

    const nonce = uuidv4();

    if (!user) {
      user = this.usersRepo.create({ walletAddress: address, nonce });
      await this.usersRepo.save(user);
      // Создаём дефолтные настройки для нового пользователя
      const settings = this.settingsRepo.create({ userId: user.id });
      await this.settingsRepo.save(settings);
    } else {
      user.nonce = nonce;
      await this.usersRepo.save(user);
    }

    return { nonce };
  }

  /** Шаг 2: верифицировать подпись и выдать токены */
  async verifySignature(dto: VerifySignatureDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; walletAddress: string; walletProvider: string };
  }> {
    const address = dto.walletAddress.toLowerCase();
    const user = await this.usersRepo.findOne({ where: { walletAddress: address } });

    if (!user || !user.nonce) {
      throw new UnauthorizedException('Сначала запросите nonce');
    }

    // Верификация подписи через ethers.js
    const message = `Войти в ArbiDex\nNonce: ${user.nonce}`;
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, dto.signature);
    } catch {
      throw new BadRequestException('Некорректная подпись');
    }

    if (recoveredAddress.toLowerCase() !== address) {
      throw new UnauthorizedException('Подпись не совпадает с адресом кошелька');
    }

    // Обновляем провайдер и сбрасываем nonce (одноразовый)
    user.walletProvider = dto.walletProvider ?? user.walletProvider;
    user.nonce = uuidv4(); // сразу меняем nonce — предотвращаем replay attack
    await this.usersRepo.save(user);

    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        walletProvider: user.walletProvider,
      },
    };
  }

  /** Обновить access-токен по refresh-токену */
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh-токен недействителен или истёк');
    }

    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Пользователь не найден');

    return this.generateTokens(user);
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const jwtPayload: JwtPayload = { sub: user.id, address: user.walletAddress };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.configService.getOrThrow<string>('jwt.accessExpiresIn') as any,
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.configService.getOrThrow<string>('jwt.refreshExpiresIn') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}


