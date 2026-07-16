import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  IconButton,
  MenuItem,
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
import type { UserToken } from '../../domain/types';

const NETWORKS = ['ARBITRUM', 'OPTIMISM', 'BASE'];

/** Сопоставление токенов: сеть, адрес контракта, название (символ), decimals. */
export function TokensPage() {
  const [tokens, setTokens] = useState<UserToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState({ network: 'ARBITRUM', address: '', symbol: '', decimals: 18 });

  useEffect(() => {
    let alive = true;
    api.settings
      .tokens()
      .then((rows) => {
        if (alive) setTokens(rows);
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, []);

  const addToken = async () => {
    setError(null);
    try {
      const created = await api.settings.createToken({
        network: newToken.network,
        address: newToken.address.trim(),
        symbol: newToken.symbol.trim(),
        decimals: newToken.decimals,
      });
      setTokens((ts) => [...ts, created]);
      setNewToken({ network: newToken.network, address: '', symbol: '', decimals: 18 });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deleteToken = async (id: string) => {
    setError(null);
    try {
      await api.settings.removeToken(id);
      setTokens((ts) => ts.filter((t) => t.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const canAddToken =
    newToken.symbol.trim().length > 0 && /^0x[0-9a-fA-F]{40}$/.test(newToken.address.trim());

  return (
    <Box>
      <PageHeader
        title="Сопоставление токенов"
        subtitle="Сеть, адрес контракта токена и его название — используется торговлей для резолва адресов пары (дополняет встроенный каталог Arbitrum)."
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} data-testid="settings-error">
          {error}
        </Alert>
      )}
      <Card data-testid="settings-tokens">
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Сеть</TableCell>
                <TableCell>Адрес токена</TableCell>
                <TableCell>Название</TableCell>
                <TableCell>Decimals</TableCell>
                <TableCell width={48} />
              </TableRow>
            </TableHead>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>{t.network}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{t.address}</TableCell>
                  <TableCell>{t.symbol}</TableCell>
                  <TableCell>{t.decimals}</TableCell>
                  <TableCell>
                    <Tooltip title="Удалить">
                      <IconButton size="small" onClick={() => deleteToken(t.id)} data-testid={`delete-token-${t.symbol}`}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={newToken.network}
                    onChange={(e) => setNewToken((v) => ({ ...v, network: e.target.value }))}
                    inputProps={{ 'data-testid': 'new-token-network' }}
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
                    fullWidth
                    placeholder="0x…"
                    value={newToken.address}
                    onChange={(e) => setNewToken((v) => ({ ...v, address: e.target.value }))}
                    inputProps={{ 'data-testid': 'new-token-address' }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    placeholder="WETH"
                    value={newToken.symbol}
                    onChange={(e) => setNewToken((v) => ({ ...v, symbol: e.target.value }))}
                    inputProps={{ 'data-testid': 'new-token-symbol' }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    sx={{ width: 90 }}
                    value={newToken.decimals}
                    onChange={(e) => setNewToken((v) => ({ ...v, decimals: Number(e.target.value) }))}
                    inputProps={{ 'data-testid': 'new-token-decimals', min: 0, max: 36 }}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="Добавить токен">
                    <span>
                      <IconButton size="small" color="primary" onClick={addToken} disabled={!canAddToken} data-testid="add-token">
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
