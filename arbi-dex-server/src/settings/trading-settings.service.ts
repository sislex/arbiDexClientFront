import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTradingContract, TradingContractKind } from './entities/user-trading-contract.entity';
import { UserToken } from './entities/user-token.entity';
import { UserComputeNode } from './entities/user-compute-node.entity';
import {
  CreateComputeNodeDto,
  CreateTradingContractDto,
  CreateUserTokenDto,
  UpdateComputeNodeDto,
  UpdateTradingContractDto,
  UpdateUserTokenDto,
} from './dto/trading-settings.dto';

const KNOWN_NETWORKS = ['ARBITRUM', 'OPTIMISM', 'BASE'];

/**
 * Пользовательские торговые настройки: списки квотер-/executor-контрактов
 * (сеть + RPC URL + адрес, записей может быть много — торговля использует
 * активную запись сети) и сопоставление токенов (сеть + адрес + название).
 */
@Injectable()
export class TradingSettingsService {
  constructor(
    @InjectRepository(UserTradingContract)
    private readonly contractsRepo: Repository<UserTradingContract>,
    @InjectRepository(UserToken)
    private readonly tokensRepo: Repository<UserToken>,
    @InjectRepository(UserComputeNode)
    private readonly nodesRepo: Repository<UserComputeNode>,
  ) {}

  // ── Квотеры / экзекутеры ───────────────────────────────────────────────────

  listContracts(userId: string, kind?: TradingContractKind): Promise<UserTradingContract[]> {
    return this.contractsRepo.find({
      where: kind ? { userId, kind } : { userId },
      order: { network: 'ASC', name: 'ASC' },
    });
  }

  async createContract(userId: string, dto: CreateTradingContractDto): Promise<UserTradingContract> {
    const network = dto.network.toUpperCase();
    if (!KNOWN_NETWORKS.includes(network)) {
      throw new BadRequestException(`Неизвестная сеть «${dto.network}». Доступны: ${KNOWN_NETWORKS.join(', ')}`);
    }
    const siblings = await this.contractsRepo.find({ where: { userId, kind: dto.kind, network } });
    // Первый контракт сети сразу активен; явный isActive снимает флаг с других.
    const makeActive = dto.isActive ?? siblings.length === 0;
    if (makeActive) await this.deactivate(userId, dto.kind, network);
    const row = this.contractsRepo.create({
      userId,
      kind: dto.kind,
      network,
      name: dto.name?.trim() ?? '',
      rpcUrl: dto.rpcUrl?.trim() ?? '',
      address: dto.address.trim().toLowerCase(),
      isActive: makeActive,
    });
    return this.contractsRepo.save(row);
  }

  async updateContract(
    userId: string,
    id: string,
    dto: UpdateTradingContractDto,
  ): Promise<UserTradingContract> {
    const row = await this.contractsRepo.findOne({ where: { id, userId } });
    if (!row) throw new NotFoundException('Контракт не найден');
    if (dto.network !== undefined) {
      const network = dto.network.toUpperCase();
      if (!KNOWN_NETWORKS.includes(network)) {
        throw new BadRequestException(`Неизвестная сеть «${dto.network}»`);
      }
      row.network = network;
    }
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.rpcUrl !== undefined) row.rpcUrl = dto.rpcUrl.trim();
    if (dto.address !== undefined) row.address = dto.address.trim().toLowerCase();
    if (dto.isActive === true) {
      await this.deactivate(userId, row.kind, row.network);
      row.isActive = true;
    } else if (dto.isActive === false) {
      row.isActive = false;
    }
    return this.contractsRepo.save(row);
  }

  async removeContract(userId: string, id: string): Promise<void> {
    const row = await this.contractsRepo.findOne({ where: { id, userId } });
    if (!row) throw new NotFoundException('Контракт не найден');
    await this.contractsRepo.remove(row);
  }

  /**
   * Контракт, который использует торговля: активная запись сети, а если
   * активной нет — единственная/первая запись; нет записей → null (.env).
   */
  async findActiveContract(
    userId: string,
    kind: TradingContractKind,
    network: string,
  ): Promise<UserTradingContract | null> {
    const rows = await this.contractsRepo.find({
      where: { userId, kind, network: network.toUpperCase() },
      order: { name: 'ASC' },
    });
    return rows.find((r) => r.isActive) ?? rows[0] ?? null;
  }

  private async deactivate(userId: string, kind: TradingContractKind, network: string): Promise<void> {
    await this.contractsRepo.update({ userId, kind, network }, { isActive: false });
  }

  // ── Токены ─────────────────────────────────────────────────────────────────

  listTokens(userId: string): Promise<UserToken[]> {
    return this.tokensRepo.find({ where: { userId }, order: { network: 'ASC', symbol: 'ASC' } });
  }

  async createToken(userId: string, dto: CreateUserTokenDto): Promise<UserToken> {
    const token = this.tokensRepo.create({
      userId,
      network: dto.network.toUpperCase(),
      address: dto.address.toLowerCase(),
      symbol: dto.symbol.trim(),
      decimals: dto.decimals ?? 18,
    });
    return this.tokensRepo.save(token);
  }

  async updateToken(userId: string, id: string, dto: UpdateUserTokenDto): Promise<UserToken> {
    const token = await this.tokensRepo.findOne({ where: { id, userId } });
    if (!token) throw new NotFoundException('Токен не найден');
    if (dto.network !== undefined) token.network = dto.network.toUpperCase();
    if (dto.address !== undefined) token.address = dto.address.toLowerCase();
    if (dto.symbol !== undefined) token.symbol = dto.symbol.trim();
    if (dto.decimals !== undefined) token.decimals = dto.decimals;
    return this.tokensRepo.save(token);
  }

  async removeToken(userId: string, id: string): Promise<void> {
    const token = await this.tokensRepo.findOne({ where: { id, userId } });
    if (!token) throw new NotFoundException('Токен не найден');
    await this.tokensRepo.remove(token);
  }

  // ── Серверы расчётов ───────────────────────────────────────────────────────

  listComputeNodes(userId: string): Promise<UserComputeNode[]> {
    return this.nodesRepo.find({ where: { userId }, order: { name: 'ASC' } });
  }

  async createComputeNode(userId: string, dto: CreateComputeNodeDto): Promise<UserComputeNode> {
    const node = this.nodesRepo.create({
      userId,
      name: dto.name?.trim() ?? '',
      baseUrl: dto.baseUrl.trim().replace(/\/+$/, ''),
      threads: dto.threads ?? 6,
      enabled: dto.enabled ?? true,
    });
    return this.nodesRepo.save(node);
  }

  async updateComputeNode(userId: string, id: string, dto: UpdateComputeNodeDto): Promise<UserComputeNode> {
    const node = await this.nodesRepo.findOne({ where: { id, userId } });
    if (!node) throw new NotFoundException('Сервер расчётов не найден');
    if (dto.name !== undefined) node.name = dto.name.trim();
    if (dto.baseUrl !== undefined) node.baseUrl = dto.baseUrl.trim().replace(/\/+$/, '');
    if (dto.threads !== undefined) node.threads = dto.threads;
    if (dto.enabled !== undefined) node.enabled = dto.enabled;
    return this.nodesRepo.save(node);
  }

  async removeComputeNode(userId: string, id: string): Promise<void> {
    const node = await this.nodesRepo.findOne({ where: { id, userId } });
    if (!node) throw new NotFoundException('Сервер расчётов не найден');
    await this.nodesRepo.remove(node);
  }

  /** Токен пользователя по символу в сети (для резолва адресов пары). */
  async findTokenBySymbol(userId: string, network: string, symbol: string): Promise<UserToken | null> {
    const rows = await this.tokensRepo.find({ where: { userId, network: network.toUpperCase() } });
    const lower = symbol.toLowerCase();
    return rows.find((t) => t.symbol.toLowerCase() === lower) ?? null;
  }
}
