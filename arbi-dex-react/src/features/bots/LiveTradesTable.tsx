import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, Chip, Box, Typography, Link, Button, Stack } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
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

/** Журнал сделок как markdown-таблица (для выгрузки в файл). */
export function tradesToMarkdown(
  trades: LiveTrade[],
  opts: { title: string; displaySide: (s: Side) => Side; displayAsset: string; cashAsset: string },
): string {
  const esc = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const lines = [
    `# ${opts.title}`,
    '',
    '| Время | Сторона | Статус | Цена | Вход | Выход | PnL | Транзакция / ошибка |',
    '|---|---|---|---:|---:|---:|---:|---|',
  ];
  for (const t of trades) {
    const side = opts.displaySide(t.side) === 'buy' ? `Покупка ${opts.displayAsset}` : `Продажа ${opts.displayAsset}`;
    lines.push(
      `| ${fmtTradeTime(t.time)} | ${side} | ${t.status === 'success' ? 'успех' : 'отклонена'} | ` +
        `${t.price != null ? t.price : '—'} | ${t.amountIn} | ${t.amountOut ?? '—'} | ` +
        `${t.pnl != null ? `${t.pnl} ${opts.cashAsset}` : '—'} | ` +
        `${t.txUrl ? `[tx](${t.txUrl})` : t.error ? esc(t.error) : t.mode === 'demo' ? 'демо' : '—'} |`,
    );
  }
  return lines.join('\n') + '\n';
}

/**
 * Кнопки выгрузки журнала: скачать markdown-файл и скопировать markdown в
 * буфер обмена (с короткой галочкой-подтверждением).
 */
export function TradesMarkdownActions({
  trades,
  markdownOpts,
  fileName,
}: {
  trades: LiveTrade[];
  markdownOpts: { title: string; displaySide: (s: Side) => Side; displayAsset: string; cashAsset: string };
  fileName: string;
}) {
  const [copied, setCopied] = useState(false);
  const buildMd = () => tradesToMarkdown(trades, markdownOpts);

  const download = () => {
    const blob = new Blob([buildMd()], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildMd());
    } catch {
      // Буфер недоступен (нет фокуса/разрешения) — fallback через textarea.
      const ta = document.createElement('textarea');
      ta.value = buildMd();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Stack direction="row" spacing={1}>
      <Button
        size="small"
        startIcon={copied ? <DoneIcon /> : <ContentCopyIcon />}
        color={copied ? 'success' : 'primary'}
        disabled={trades.length === 0}
        onClick={copy}
        data-testid="trades-copy-md"
      >
        {copied ? 'Скопировано' : 'Копировать markdown'}
      </Button>
      <Button
        size="small"
        startIcon={<DownloadIcon />}
        disabled={trades.length === 0}
        onClick={download}
        data-testid="trades-download-md"
      >
        Скачать markdown
      </Button>
    </Stack>
  );
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
