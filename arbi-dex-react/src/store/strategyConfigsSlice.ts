import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { StrategyConfig } from '../domain/types';
import { api } from '../api';
import type { Status } from './authSlice';

interface State {
  items: StrategyConfig[];
  status: Status;
}

const initialState: State = { items: [], status: 'idle' };

export const fetchStrategyConfigs = createAsyncThunk('strategyConfigs/fetchAll', () => api.strategyConfigs.list());
export const createStrategyConfig = createAsyncThunk(
  'strategyConfigs/create',
  (input: Omit<StrategyConfig, 'id' | 'createdAt'>) => api.strategyConfigs.create(input),
);
export const updateStrategyConfig = createAsyncThunk(
  'strategyConfigs/update',
  ({ id, patch }: { id: string; patch: Partial<StrategyConfig> }) => api.strategyConfigs.update(id, patch),
);
export const removeStrategyConfig = createAsyncThunk('strategyConfigs/remove', async (id: string) => {
  await api.strategyConfigs.remove(id);
  return id;
});

const slice = createSlice({
  name: 'strategyConfigs',
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchStrategyConfigs.pending, (s) => {
      s.status = 'loading';
    });
    b.addCase(fetchStrategyConfigs.fulfilled, (s, a) => {
      s.status = 'succeeded';
      s.items = a.payload;
    });
    b.addCase(createStrategyConfig.fulfilled, (s, a) => {
      s.items.unshift(a.payload);
    });
    b.addCase(updateStrategyConfig.fulfilled, (s, a) => {
      const i = s.items.findIndex((x) => x.id === a.payload.id);
      if (i >= 0) s.items[i] = a.payload;
    });
    b.addCase(removeStrategyConfig.fulfilled, (s, a) => {
      s.items = s.items.filter((x) => x.id !== a.payload);
    });
  },
});

export const strategyConfigsReducer = slice.reducer;
