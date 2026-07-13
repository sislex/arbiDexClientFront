import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Bot } from '../domain/types';
import { api } from '../api';
import type { Status } from './authSlice';

interface BotsState {
  items: Bot[];
  current: Bot | null;
  status: Status;
  error: string | null;
}

const initialState: BotsState = { items: [], current: null, status: 'idle', error: null };

export const fetchBots = createAsyncThunk('bots/fetchAll', () => api.bots.list());
export const fetchBot = createAsyncThunk('bots/fetchOne', (id: string) => api.bots.get(id));
export const createBot = createAsyncThunk(
  'bots/create',
  (input: Omit<Bot, 'id' | 'createdAt' | 'updatedAt'>) => api.bots.create(input),
);
export const updateBot = createAsyncThunk(
  'bots/update',
  ({ id, patch }: { id: string; patch: Partial<Bot> }) => api.bots.update(id, patch),
);

const botsSlice = createSlice({
  name: 'bots',
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchBots.pending, (s) => {
      s.status = 'loading';
    });
    b.addCase(fetchBots.fulfilled, (s, a) => {
      s.status = 'succeeded';
      s.items = a.payload;
    });
    b.addCase(fetchBots.rejected, (s, a) => {
      s.status = 'failed';
      s.error = a.error.message ?? null;
    });
    b.addCase(fetchBot.fulfilled, (s, a) => {
      s.current = a.payload ?? null;
    });
    b.addCase(createBot.fulfilled, (s, a) => {
      s.items.unshift(a.payload);
    });
    b.addCase(updateBot.fulfilled, (s, a) => {
      const i = s.items.findIndex((x) => x.id === a.payload.id);
      if (i >= 0) s.items[i] = a.payload;
      if (s.current?.id === a.payload.id) s.current = a.payload;
    });
  },
});

export const botsReducer = botsSlice.reducer;
