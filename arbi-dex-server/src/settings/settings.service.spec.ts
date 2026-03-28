import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { UserSettings } from './entities/user-settings.entity';

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const USER_ID = 'user-uuid-1';

const defaultSettings: UserSettings = {
  id: 'settings-uuid-1',
  userId: USER_ID,
  theme: 'light',
  density: 'default',
  sidebarOpened: true,
  user: null as any,
};

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(UserSettings), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  // ── findByUser ──────────────────────────────────────────────────────────────

  describe('findByUser', () => {
    it('должен вернуть существующие настройки', async () => {
      mockRepo.findOne.mockResolvedValue(defaultSettings);

      const result = await service.findByUser(USER_ID);

      expect(result).toEqual(defaultSettings);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('должен создать дефолтные настройки если их нет', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(defaultSettings);
      mockRepo.save.mockResolvedValue(defaultSettings);

      const result = await service.findByUser(USER_ID);

      expect(result).toEqual(defaultSettings);
      expect(mockRepo.create).toHaveBeenCalledWith({ userId: USER_ID });
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('должен обновить тему', async () => {
      const updated = { ...defaultSettings, theme: 'dark' };
      mockRepo.findOne
        .mockResolvedValueOnce({ ...defaultSettings })   // 1-й вызов: поиск
        .mockResolvedValueOnce(updated);                  // 2-й вызов: перезагрузка
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(USER_ID, { theme: 'dark' });

      expect(result.theme).toBe('dark');
    });

    it('должен обновить несколько полей одновременно', async () => {
      const updated = { ...defaultSettings, theme: 'dark', density: 'compact', sidebarOpened: false };
      mockRepo.findOne
        .mockResolvedValueOnce({ ...defaultSettings })
        .mockResolvedValueOnce(updated);
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(USER_ID, {
        theme: 'dark',
        density: 'compact',
        sidebarOpened: false,
      });

      expect(result.theme).toBe('dark');
      expect(result.density).toBe('compact');
      expect(result.sidebarOpened).toBe(false);
    });

    it('должен создать настройки если их нет и сразу обновить', async () => {
      const updated = { userId: USER_ID, theme: 'dark', density: 'default', sidebarOpened: true };
      mockRepo.findOne
        .mockResolvedValueOnce(null)                      // 1-й: не найден
        .mockResolvedValueOnce(updated);                  // 2-й: перезагрузка
      mockRepo.create.mockReturnValue({ userId: USER_ID, theme: 'light', density: 'default', sidebarOpened: true });
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(USER_ID, { theme: 'dark' });

      expect(mockRepo.create).toHaveBeenCalledWith({ userId: USER_ID });
      expect(result.theme).toBe('dark');
    });

    it('не должен менять поля которые не переданы', async () => {
      const existing = { ...defaultSettings };
      const updated = { ...defaultSettings, theme: 'dark' };
      mockRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(USER_ID, { theme: 'dark' });

      // density и sidebarOpened не изменились
      expect(result.density).toBe('default');
      expect(result.sidebarOpened).toBe(true);
    });
  });
});

