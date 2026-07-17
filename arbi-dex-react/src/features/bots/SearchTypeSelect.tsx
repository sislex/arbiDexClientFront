import { Box, MenuItem, TextField, Typography } from '@mui/material';
import type { SearchType } from '../../domain/types';

/** Описания типов перебора — показываются в выпадающем списке и под полем. */
export const SEARCH_TYPES: { value: SearchType; label: string; description: string }[] = [
  {
    value: 'grid',
    label: 'Обычный перебор',
    description:
      'Равномерно проходит всю сетку: лимит прогонов распределяется по всем комбинациям с одинаковым шагом, покрывая весь диапазон каждого параметра. Предсказуемое покрытие, но на огромных сетках расстояние между проверенными точками растёт.',
  },
  {
    value: 'refine',
    label: 'Уточняющий (быстрый)',
    description:
      'Работает раундами (3): первый равномерно проходит всю сетку, затем диапазоны параметров сужаются вокруг топ-10 результатов (±1 шаг сетки), и следующий раунд ищет уже в уменьшенной области без повторов. Быстрее находит хорошие коэффициенты на больших сетках.',
  },
  {
    value: 'random',
    label: 'Случайный поиск',
    description:
      'Каждая комбинация собирается из случайных значений параметров (повторы отсеиваются). В отличие от равномерной решётки не имеет систематических пропусков между её узлами — несмещённая выборка для очень больших сеток.',
  },
];

/** Селект типа перебора с описанием выбранного типа под полем. */
export function SearchTypeSelect({
  value,
  onChange,
  dataTestId,
}: {
  value: SearchType;
  onChange: (v: SearchType) => void;
  dataTestId?: string;
}) {
  const current = SEARCH_TYPES.find((t) => t.value === value);
  return (
    <TextField
      select
      label="Тип перебора"
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value as SearchType)}
      sx={{ minWidth: 210, maxWidth: 260 }}
      inputProps={{ 'data-testid': dataTestId }}
      helperText={current?.description}
      // В закрытом поле показываем только название (без описания).
      SelectProps={{ renderValue: () => current?.label ?? value }}
    >
      {SEARCH_TYPES.map((t) => (
        <MenuItem key={t.value} value={t.value} sx={{ maxWidth: 420, whiteSpace: 'normal' }}>
          <Box>
            <Typography variant="body2">{t.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t.description}
            </Typography>
          </Box>
        </MenuItem>
      ))}
    </TextField>
  );
}
