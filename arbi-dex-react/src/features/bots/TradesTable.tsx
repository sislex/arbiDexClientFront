import { Table, TableBody, TableCell, TableHead, TableRow, Chip, Box, Typography } from '@mui/material';
import type { Trade } from '../../domain/types';
import { PnlValue } from '../../components/PnlValue';
import { fmtTime } from '../../components/format';

const REASON_LABEL: Record<string, string> = {
  stop_loss: 'стоп-лосс',
  trailing_take_profit: 'trailing TP',
  max_holding_time: 'время удержания',
  close_at_end: 'закрытие в конце',
};

export function TradesTable({ trades }: { trades: Trade[] }) {
  return (
    <Box sx={{ maxHeight: 320, overflow: 'auto' }} data-testid="trades-table">
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Время</TableCell>
            <TableCell>Сторона</TableCell>
            <TableCell align="right">Цена</TableCell>
            <TableCell align="right">Объём</TableCell>
            <TableCell align="right">PnL</TableCell>
            <TableCell>Причина</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {trades.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{fmtTime(t.time)}</TableCell>
              <TableCell>
                <Chip size="small" label={t.side === 'buy' ? 'Покупка' : 'Продажа'} color={t.side === 'buy' ? 'success' : 'error'} variant="outlined" />
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{t.price}</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{t.amount.toFixed(4)}</TableCell>
              <TableCell align="right">{t.pnl != null ? <PnlValue value={t.pnl} /> : '—'}</TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">{t.reason ? REASON_LABEL[t.reason] ?? t.reason : '—'}</Typography>
              </TableCell>
            </TableRow>
          ))}
          {trades.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography color="text.secondary" sx={{ py: 1 }}>Сделок нет</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
