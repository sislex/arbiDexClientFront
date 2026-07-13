import { Chip } from '@mui/material';
import type { BotStatus, TradingMode } from '../domain/types';

const STATUS: Record<BotStatus, { label: string; color: 'success' | 'warning' | 'default' | 'error' }> = {
  running: { label: 'Работает', color: 'success' },
  paused: { label: 'Пауза', color: 'warning' },
  stopped: { label: 'Остановлен', color: 'default' },
  error: { label: 'Ошибка', color: 'error' },
};

const MODE: Record<TradingMode, { label: string; color: 'info' | 'error' | 'default' }> = {
  'demo-live': { label: 'Демо', color: 'info' },
  'real-live': { label: 'Реальный', color: 'error' },
  idle: { label: 'Простой', color: 'default' },
};

export function StatusBadge({ status }: { status: BotStatus }) {
  const s = STATUS[status];
  return <Chip size="small" label={s.label} color={s.color} variant={s.color === 'default' ? 'outlined' : 'filled'} />;
}

export function ModeBadge({ mode }: { mode: TradingMode }) {
  const m = MODE[mode];
  return <Chip size="small" label={m.label} color={m.color} variant="outlined" />;
}
