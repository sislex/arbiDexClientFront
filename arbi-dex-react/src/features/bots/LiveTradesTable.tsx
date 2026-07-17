import { Table, TableBody, TableCell, TableHead, TableRow, Chip, Box, Typography, Link } from '@mui/material';
import type { LiveTrade, Side } from '../../domain/types';
import { PnlValue } from '../../components/PnlValue';

/** Time with seconds — live trades within one day differ by seconds. */
function fmtTradeTime(unixMs: number): string {
  return new Date(unixMs).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Журнал live-сделок под графиком — аналог таблицы сделок бэктеста, но с
 * фактическим статусом (успех / отклонена и почему) и ссылкой на транзакцию.
 * Стороны показываются в рыночной семантике (`toDisplaySide` вызывающего).
 */
export function LiveTradesTable({
  trades,
  displaySide,
  displayAsset,
  onRowClick,
}: {
  trades: LiveTrade[];
  /** Бот-сторона → сторона в терминах актива графика (инверсные листинги). */
  displaySide: (s: Side) => Side;
  /** Актив графика (что покупаем/продаём на кнопках). */
  displayAsset: string;
  /** Клик по строке — подсветить шаг сделки на графике. */
  onRowClick?: (trade: LiveTrade) => void;
}) {
  return (
    <Box sx={{ maxHeight: 320, overflow: 'auto' }} data-testid="live-trades-table">
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Время</TableCell>
            <TableCell>Сторона</TableCell>
            <TableCell>Статус</TableCell>
            <TableCell align="right">Цена</TableCell>
            <TableCell align="right">Объём</TableCell>
            <TableCell align="right">PnL</TableCell>
            <TableCell>Детали</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {[...trades].reverse().map((t) => {
            const side = displaySide(t.side);
            return (
              <TableRow
                key={t.id}
                hover={!!onRowClick}
                onClick={() => onRowClick?.(t)}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
                data-testid={`live-trade-row-${t.id}`}
              >
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtTradeTime(t.time)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${side === 'buy' ? 'Покупка' : 'Продажа'} ${displayAsset}`}
                    color={side === 'buy' ? 'success' : 'error'}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={t.status === 'success' ? 'успех' : 'отклонена'}
                    color={t.status === 'success' ? 'success' : 'error'}
                    variant={t.status === 'success' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t.price != null ? t.price.toFixed(4) : '—'}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t.amountIn.toPrecision(4)}
                  {t.amountOut != null ? ` → ${t.amountOut.toPrecision(4)}` : ''}
                </TableCell>
                <TableCell align="right">{t.pnl != null ? <PnlValue value={t.pnl} /> : '—'}</TableCell>
                <TableCell sx={{ maxWidth: 260 }}>
                  {t.txUrl ? (
                    <Link href={t.txUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      транзакция
                    </Link>
                  ) : t.error ? (
                    <Typography variant="caption" color="error.main" sx={{ display: 'block' }} noWrap title={t.error}>
                      {t.error}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {t.mode === 'demo' ? 'демо' : '—'}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {trades.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <Typography color="text.secondary" sx={{ py: 1 }}>
                  Сделок с момента запуска нет
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
