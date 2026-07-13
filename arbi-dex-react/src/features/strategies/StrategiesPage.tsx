import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Typography, IconButton, Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { PageHeader } from '../../components/PageHeader';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchStrategyConfigs, removeStrategyConfig } from '../../store/strategyConfigsSlice';

export function StrategiesPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const items = useAppSelector((s) => s.strategyConfigs.items);
  /** Strategy pending deletion (shows the confirm dialog); null when none. */
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    dispatch(fetchStrategyConfigs());
  }, [dispatch]);

  const confirmDelete = () => {
    if (toDelete) dispatch(removeStrategyConfig(toDelete.id));
    setToDelete(null);
  };

  return (
    <Box>
      <PageHeader
        title="Стратегии"
        subtitle="Наборы условий автоторговли с коэффициентами"
        actions={
          <Button variant="contained" startIcon={<AddCircleIcon />} onClick={() => navigate('/strategies/new')} data-testid="create-strategy">
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
                <TableCell>Условий покупки</TableCell>
                <TableCell>Условий продажи</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/strategies/${s.id}`)} data-testid={`st-row-${s.id}`}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.buy.filter((c) => c.enabled).length}</TableCell>
                  <TableCell>{s.sell.filter((c) => c.enabled).length}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={`Удалить стратегию ${s.name}`}
                      data-testid={`st-delete-${s.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setToDelete({ id: s.id, name: s.name });
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>Пока нет стратегий.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} data-testid="st-delete-dialog">
        <DialogTitle>Удалить стратегию?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Стратегия «{toDelete?.name}» будет удалена без возможности восстановления. Боты, использующие
            её, останутся без стратегии — бэктест для них не запустится, пока вы не привяжете другую.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)} data-testid="st-delete-cancel">Отмена</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" data-testid="st-delete-confirm">
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
