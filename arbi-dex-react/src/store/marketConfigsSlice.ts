import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { MarketConfig } from '../domain/types';
import { api } from '../api';
import type { Status } from './authSlice';

interface State {
  items: MarketConfig[];
  status: Status;
}

const initialState: State = { items: [], status: 'idle' };

export const fetchMarketConfigs = createAsyncThunk('marketConfigs/fetchAll', () => api.marketConfigs.list());
export const createMarketConfig = createAsyncThunk(
  'marketConfigs/create',
  (input: Omit<MarketConfig, 'id' | 'createdAt'>) => api.marketConfigs.create(input),
);
export const updateMarketConfig = createAsyncThunk(
  'marketConfigs/update',
  ({ id, patch }: { id: string; patch: Partial<MarketConfig> }) => api.marketConfigs.update(id, patch),
);
export const removeMarketConfig = createAsyncThunk('marketConfigs/remove', async (id: string) => {
  await api.marketConfigs.remove(id);
  return id;
});

const slice = createSlice({
  name: 'marketConfigs',
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchMarketConfigs.pending, (s) => {
      s.status = 'loading';
    });
    b.addCase(fetchMarketConfigs.fulfilled, (s, a) => {
      s.status = 'succeeded';
      s.items = a.payload;
    });
    b.addCase(createMarketConfig.fulfilled, (s, a) => {
      s.items.unshift(a.payload);
    });
    b.addCase(updateMarketConfig.fulfilled, (s, a) => {
      const i = s.items.findIndex((x) => x.id === a.payload.id);
      if (i >= 0) s.items[i] = a.payload;
    });
    b.addCase(removeMarketConfig.fulfilled, (s, a) => {
      s.items = s.items.filter((x) => x.id !== a.payload);
    });
  },
});

export const marketConfigsReducer = slice.reducer;
