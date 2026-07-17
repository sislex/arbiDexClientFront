import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../api';
import type { ComputeConfig, ComputeNode } from '../../domain/types';

/**
 * Настройки вычислений: пул потоков сервера (сколько расчётов идёт
 * параллельно) и адреса дополнительных серверов расчётов для распределения
 * прогонов (узлы хранятся здесь; распределение — следующий этап).
 */
export function ComputeSettingsPage() {
  const [config, setConfig] = useState<ComputeConfig | null>(null);
  const [threads, setThreads] = useState(6);
  const [nodes, setNodes] = useState<ComputeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [newNode, setNewNode] = useState({ name: '', baseUrl: '', threads: 6 });

  useEffect(() => {
    let alive = true;
    api.compute
      .config()
      .then((c) => {
        if (!alive) return;
        setConfig(c);
        setThreads(c.totalThreads);
      })
      .catch((e) => setError((e as Error).message));
    api.settings
      .computeNodes()
      .then((rows) => {
        if (alive) setNodes(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const saveThreads = async () => {
    setError(null);
    try {
      const c = await api.compute.updateConfig(threads);
      setConfig(c);
      setSaved(`Потоков сервера: ${c.totalThreads}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const addNode = async () => {
    setError(null);
    try {
      const created = await api.settings.createComputeNode({
        name: newNode.name.trim(),
        baseUrl: newNode.baseUrl.trim(),
        threads: newNode.threads,
        enabled: true,
      });
      setNodes((ns) => [...ns, created]);
      setNewNode({ name: '', baseUrl: '', threads: 6 });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleNode = async (node: ComputeNode) => {
    setError(null);
    try {
      const updated = await api.settings.updateComputeNode(node.id, { enabled: !node.enabled });
      setNodes((ns) => ns.map((n) => (n.id === node.id ? updated : n)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeNode = async (id: string) => {
    setError(null);
    try {
      await api.settings.removeComputeNode(id);
      setNodes((ns) => ns.filter((n) => n.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const canAdd = newNode.baseUrl.trim().length > 3;

  return (
    <Box>
      <PageHeader
        title="Вычисления"
        subtitle="Пул потоков сервера для параллельных расчётов и адреса дополнительных серверов."
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(null)}>{saved}</Alert>}

      <Stack spacing={2}>
        <Card data-testid="compute-threads-card">
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Потоки сервера</Typography>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              <TextField
                label="Параллельных потоков расчёта"
                size="small"
                type="number"
                value={threads}
                onChange={(e) => setThreads(Math.max(1, Math.min(64, Math.round(Number(e.target.value) || 1))))}
                inputProps={{ min: 1, max: 64, 'data-testid': 'compute-threads' }}
                sx={{ width: 240 }}
              />
              <Button variant="contained" startIcon={<SaveIcon />} onClick={saveThreads} data-testid="save-compute-threads">
                Сохранить
              </Button>
              {config && (
                <>
                  <Chip size="small" variant="outlined" label={`сейчас занято: ${config.activeThreads}`} />
                  <Chip size="small" variant="outlined" label={`в очереди: ${config.queuedJobs}`} />
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card data-testid="compute-nodes-card">
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>Серверы расчётов</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Адреса других задеплоенных arbi-dex-server — для распределения параллельных прогонов
              по нескольким машинам (узлы сохраняются; само распределение будет включено отдельно).
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={70}>Вкл.</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>URL сервера</TableCell>
                  <TableCell align="right">Потоков</TableCell>
                  <TableCell width={48} />
                </TableRow>
              </TableHead>
              <TableBody>
                {nodes.map((n) => (
                  <TableRow key={n.id} hover>
                    <TableCell>
                      <Switch size="small" checked={n.enabled} onChange={() => toggleNode(n)} />
                    </TableCell>
                    <TableCell>{n.name || '—'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{n.baseUrl}</TableCell>
                    <TableCell align="right">{n.threads}</TableCell>
                    <TableCell>
                      <Tooltip title="Удалить">
                        <IconButton size="small" onClick={() => removeNode(n.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell />
                  <TableCell>
                    <TextField
                      size="small"
                      placeholder="Название"
                      value={newNode.name}
                      onChange={(e) => setNewNode((v) => ({ ...v, name: e.target.value }))}
                      inputProps={{ 'data-testid': 'new-node-name' }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="http://10.0.0.5:3006/api"
                      value={newNode.baseUrl}
                      onChange={(e) => setNewNode((v) => ({ ...v, baseUrl: e.target.value }))}
                      inputProps={{ 'data-testid': 'new-node-url' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      sx={{ width: 90 }}
                      value={newNode.threads}
                      onChange={(e) => setNewNode((v) => ({ ...v, threads: Math.max(1, Math.min(64, Math.round(Number(e.target.value) || 1))) }))}
                      inputProps={{ min: 1, max: 64, 'data-testid': 'new-node-threads' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Добавить сервер">
                      <span>
                        <IconButton size="small" color="primary" onClick={addNode} disabled={!canAdd} data-testid="add-node">
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
      </Stack>
    </Box>
  );
}
