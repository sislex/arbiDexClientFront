import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Typography, Chip, IconButton, Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { PageHeader } from '../../components/PageHeader';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchMarketConfigs, removeMarketConfig } from '../../store/marketConfigsSlice';
import { fetchMarkets } from '../../store/catalogSlice';
import { findMarket, marketLabel } from './marketLabel';

export function MarketConfigsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const configs = useAppSelector((s) => s.marketConfigs.items);
  const markets = useAppSelector((s) => s.catalog.markets);
  /** Config pending deletion (shows the confirm dialog); null when none. */
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    dispatch(fetchMarketConfigs());
    dispatch(fetchMarkets());
  }, [dispatch]);

  const confirmDelete = () => {
    if (toDelete) dispatch(removeMarketConfig(toDelete.id));
    setToDelete(null);
  };

  return (
    <Box>
      <PageHeader
        title="Конфигурации рынков"
        subtitle="Торговый рынок + наблюдаемые рынки для средневзвешенной цены"
        actions={
          <Button variant="contained" startIcon={<AddCircleIcon />} onClick={() => navigate('/market-configs/new')} data-testid="create-market-config">
            Создать
          </Button>
        }
      />
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Торговый рынок</TableCell>
                <TableCell>Наблюдаемые</TableCell>
                <TableCell>Средневзвеш.</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.map((c) => {
                const trading = findMarket(markets, c.tradingMarketId);
                return (
                  <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/market-configs/${c.id}`)} data-testid={`mc-row-${c.id}`}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{trading ? marketLabel(trading) : '—'}</TableCell>
                    <TableCell>{c.observedMarketIds.length}</TableCell>
                    <TableCell>
                      <Chip size="small" label={c.useWeightedAverage ? 'вкл' : 'выкл'} color={c.useWeightedAverage ? 'primary' : 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label={`Удалить конфигурацию ${c.name}`}
                        data-testid={`mc-delete-${c.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setToDelete({ id: c.id, name: c.name });
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {configs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      Пока нет конфигураций рынков.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} data-testid="mc-delete-dialog">
        <DialogTitle>Удалить конфигурацию рынков?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Конфигурация «{toDelete?.name}» будет удалена без возможности восстановления. Боты, использующие
            её, останутся без рынка — бэктест для них не запустится, пока вы не привяжете другую.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)} data-testid="mc-delete-cancel">Отмена</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" data-testid="mc-delete-confirm">
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
