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

export function TradesTable({
  trades,
  tokenAsset,
  cashAsset,
  onRowClick,
}: {
  trades: Trade[];
  /** The position asset (what buys receive) — see features/bots/botAssets. */
  tokenAsset?: string;
  /** The asset quotes/balances are denominated in (what sells receive). */
  cashAsset?: string;
  /** Row click — e.g. to highlight the trade's step on the chart. */
  onRowClick?: (trade: Trade) => void;
}) {
  // What we RECEIVE in the trade: buy → tokens, sell → cash.
  const received = (t: Trade): string => {
    const value = t.side === 'buy' ? t.amount : t.amount * t.price;
    const asset = t.side === 'buy' ? tokenAsset : cashAsset;
    return `${value.toFixed(4)}${asset ? ` ${asset}` : ''}`;
  };
  return (
    <Box sx={{ maxHeight: 320, overflow: 'auto' }} data-testid="trades-table">
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Время</TableCell>
            <TableCell>Сторона</TableCell>
            <TableCell align="right">Цена</TableCell>
            <TableCell align="right">Получено</TableCell>
            <TableCell align="right">PnL</TableCell>
            <TableCell>Причина</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {trades.map((t) => (
            <TableRow
              key={t.id}
              hover={!!onRowClick}
              onClick={() => onRowClick?.(t)}
              sx={onRowClick ? { cursor: 'pointer' } : undefined}
              data-testid={`trade-row-${t.id}`}
            >
              <TableCell>{fmtTime(t.time > 1e12 ? t.time / 1000 : t.time)}</TableCell>
              <TableCell>
                <Chip size="small" label={t.side === 'buy' ? 'Покупка' : 'Продажа'} color={t.side === 'buy' ? 'success' : 'error'} variant="outlined" />
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{t.price}</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{received(t)}</TableCell>
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
