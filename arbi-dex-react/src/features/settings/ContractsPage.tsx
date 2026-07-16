import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  IconButton,
  MenuItem,
  Radio,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../api';
import type { TradingContract } from '../../domain/types';

const NETWORKS = ['ARBITRUM', 'OPTIMISM', 'BASE'];

const emptyForm = { network: 'ARBITRUM', name: '', rpcUrl: '', address: '' };

/**
 * Список квотер- или executor-контрактов (задаётся `kind`): сеть, название,
 * RPC URL, адрес. Записей можно добавлять сколько угодно; торговля использует
 * активную запись сети (переключается радиокнопкой). Без записей — .env сервера.
 */
export function ContractsPage({ kind }: { kind: 'quoter' | 'executor' }) {
  const isQuoter = kind === 'quoter';
  const [rows, setRows] = useState<TradingContract[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.settings
      .contracts(kind)
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [kind]);

  const add = async () => {
    setError(null);
    try {
      const created = await api.settings.createContract({
        kind,
        network: form.network,
        name: form.name.trim(),
        rpcUrl: form.rpcUrl.trim(),
        address: form.address.trim(),
      });
      // Сервер мог снять активность с другой записи сети — перечитываем список.
      setRows(await api.settings.contracts(kind));
      setForm({ ...emptyForm, network: created.network });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const activate = async (id: string) => {
    setError(null);
    try {
      await api.settings.updateContract(id, { isActive: true });
      setRows(await api.settings.contracts(kind));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await api.settings.removeContract(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const canAdd = /^0x[0-9a-fA-F]{40}$/.test(form.address.trim());

  return (
    <Box>
      <PageHeader
        title={isQuoter ? 'Квотеры' : 'Экзекутеры'}
        subtitle={
          (isQuoter
            ? 'Квотер-контракты (ArbQuoter) — котировки без исполнения. '
            : 'Executor-контракты (ArbExecutor) — исполнение реальных свопов on-chain. ') +
          'Торговля использует активную запись сети; если записей нет — конфигурацию сервера (.env). ' +
          'Пустой RPC URL — используется RPC сети из .env.'
        }
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} data-testid="contracts-error">
          {error}
        </Alert>
      )}
      <Card data-testid={`contracts-${kind}`}>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={70}>Активен</TableCell>
                <TableCell>Сеть</TableCell>
                <TableCell>Название</TableCell>
                <TableCell>RPC URL</TableCell>
                <TableCell>Адрес контракта</TableCell>
                <TableCell width={48} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Tooltip title="Использовать для торговли в этой сети">
                      <Radio
                        size="small"
                        checked={r.isActive}
                        onChange={() => activate(r.id)}
                        inputProps={{ 'data-testid': `activate-${r.id}` } as never}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>{r.network}</TableCell>
                  <TableCell>{r.name || '—'}</TableCell>
                  <TableCell sx={{ fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.rpcUrl || 'RPC из .env'}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.address}</TableCell>
                  <TableCell>
                    <Tooltip title="Удалить">
                      <IconButton size="small" onClick={() => remove(r.id)} data-testid={`delete-contract-${r.id}`}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {/* Строка добавления */}
              <TableRow>
                <TableCell />
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={form.network}
                    onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))}
                    inputProps={{ 'data-testid': 'new-contract-network' }}
                  >
                    {NETWORKS.map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    placeholder="Название"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    inputProps={{ 'data-testid': 'new-contract-name' }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="https://… (пусто — RPC из .env)"
                    value={form.rpcUrl}
                    onChange={(e) => setForm((f) => ({ ...f, rpcUrl: e.target.value }))}
                    inputProps={{ 'data-testid': 'new-contract-rpc' }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="0x…"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    inputProps={{ 'data-testid': 'new-contract-address' }}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="Добавить">
                    <span>
                      <IconButton size="small" color="primary" onClick={add} disabled={!canAdd} data-testid="add-contract">
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
