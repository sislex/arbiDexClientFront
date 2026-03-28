import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly repo: Repository<UserSettings>,
  ) {}

  async findByUser(userId: string): Promise<UserSettings> {
    let settings = await this.repo.findOne({ where: { userId } });
    if (!settings) {
      settings = this.repo.create({ userId });
      await this.repo.save(settings);
    }
    return settings;
  }

  async update(userId: string, dto: UpdateSettingsDto): Promise<UserSettings> {
    let settings = await this.repo.findOne({ where: { userId } });
    if (!settings) {
      settings = this.repo.create({ userId });
    }
    Object.assign(settings, dto);
    await this.repo.save(settings);
    // Перезагружаем из БД чтобы вернуть все поля (включая defaults)
    return this.repo.findOne({ where: { userId } }) as Promise<UserSettings>;
  }
}
