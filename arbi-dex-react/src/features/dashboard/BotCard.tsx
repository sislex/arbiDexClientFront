import { Card, CardActionArea, CardContent, Stack, Typography, Divider, Box } from '@mui/material';
import type { Bot } from '../../domain/types';
import { StatusBadge, ModeBadge } from '../../components/StatusBadge';
import { PnlValue } from '../../components/PnlValue';
import { fmtMoney } from '../../components/format';

export function BotCard({ bot, onOpen }: { bot: Bot; onOpen: (id: string) => void }) {
  return (
    <Card sx={{ width: 320 }}>
      <CardActionArea onClick={() => onOpen(bot.id)} data-testid={`bot-card-${bot.id}`}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {bot.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {bot.baseAsset}/{bot.quoteAsset}
              </Typography>
            </Box>
            <Stack spacing={0.5} alignItems="flex-end">
              <StatusBadge status={bot.status} />
              <ModeBadge mode={bot.mode} />
            </Stack>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Stack direction="row" justifyContent="space-between">
            <Box>
              <Typography variant="caption" color="text.secondary">
                PnL
              </Typography>
              <div>
                <PnlValue value={bot.pnl} pct={bot.pnlPct} variant="subtitle1" />
              </div>
            </Box>
            <Box textAlign="right">
              <Typography variant="caption" color="text.secondary">
                Баланс
              </Typography>
              <Typography variant="subtitle1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmtMoney(bot.balance, bot.quoteAsset)}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Сделок: <b>{bot.tradesCount}</b>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Winrate: <b>{bot.winRate}%</b>
            </Typography>
            {bot.openPosition && (
              <Typography variant="caption" color="info.main">
                позиция открыта
              </Typography>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
