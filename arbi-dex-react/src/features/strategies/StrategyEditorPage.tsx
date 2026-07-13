import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Stack, TextField, Typography, FormControlLabel, Switch, Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { PageHeader } from '../../components/PageHeader';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchStrategyConfigs, createStrategyConfig, updateStrategyConfig } from '../../store/strategyConfigsSlice';
import { getCatalogEntry, defaultStrategySides } from '../../domain/conditionsCatalog';
import type { StrategyConditionValue } from '../../domain/types';
import { ConditionEditor } from './ConditionEditor';

function Section({
  title,
  icon,
  side,
  values,
  showTuning,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  side: 'buy' | 'sell';
  values: StrategyConditionValue[];
  showTuning: boolean;
  onChange: (next: StrategyConditionValue[]) => void;
}) {
  return (
    <Card sx={{ flex: 1, minWidth: 320 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          {icon}
          <Typography variant="h6">{title}</Typography>
        </Stack>
        <Stack spacing={1.5}>
          {values.map((cv, i) => {
            const entry = getCatalogEntry(cv.conditionId);
            if (!entry) return null;
            return (
              <ConditionEditor
                key={cv.conditionId}
                entry={entry}
                value={cv}
                side={side}
                showTuning={showTuning}
                onChange={(next) => {
                  const copy = values.slice();
                  copy[i] = next;
                  onChange(copy);
                }}
              />
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function StrategyEditorPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;
  const existing = useAppSelector((s) => s.strategyConfigs.items.find((x) => x.id === id));

  const defaults = defaultStrategySides();
  const [name, setName] = useState('');
  const [buy, setBuy] = useState<StrategyConditionValue[]>(defaults.buy);
  const [sell, setSell] = useState<StrategyConditionValue[]>(defaults.sell);
  const [showTuning, setShowTuning] = useState(false);

  useEffect(() => {
    dispatch(fetchStrategyConfigs());
  }, [dispatch]);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setBuy(existing.buy);
      setSell(existing.sell);
    }
  }, [existing]);

  const canSave = name.trim().length > 0;

  const save = async () => {
    const payload = { name: name.trim(), buy, sell };
    if (isNew) await dispatch(createStrategyConfig(payload));
    else await dispatch(updateStrategyConfig({ id: id!, patch: payload }));
    navigate('/strategies');
  };

  return (
    <Box>
      <PageHeader
        title={isNew ? 'Новая стратегия' : 'Конфигурация стратегии'}
        subtitle="Условия покупки и продажи с коэффициентами (движок arbi-conditions-libs)"
        actions={
          <Button variant="contained" startIcon={<SaveIcon />} disabled={!canSave} onClick={save} data-testid="save-strategy">
            Сохранить
          </Button>
        }
      />

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={3} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            <TextField
              label="Название стратегии"
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              inputProps={{ 'data-testid': 'strategy-name' }}
              sx={{ minWidth: 300 }}
            />
            <Divider orientation="vertical" flexItem />
            <FormControlLabel
              control={<Switch checked={showTuning} onChange={(e) => setShowTuning(e.target.checked)} inputProps={{ 'data-testid': 'toggle-tuning' } as never} />}
              label="Показать диапазоны авто-подбора"
            />
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
        <Section title="Условия покупки" icon={<TrendingUpIcon color="success" />} side="buy" values={buy} showTuning={showTuning} onChange={setBuy} />
        <Section title="Условия продажи" icon={<TrendingDownIcon color="error" />} side="sell" values={sell} showTuning={showTuning} onChange={setSell} />
      </Stack>
    </Box>
  );
}
