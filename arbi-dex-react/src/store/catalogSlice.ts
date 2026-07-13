import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Market } from '../domain/types';
import { api } from '../api';
import type { Status } from './authSlice';

interface State {
  markets: Market[];
  status: Status;
}

const initialState: State = { markets: [], status: 'idle' };

export const fetchMarkets = createAsyncThunk('catalog/fetchMarkets', () => api.catalog.markets());

const slice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchMarkets.pending, (s) => {
      s.status = 'loading';
    });
    b.addCase(fetchMarkets.fulfilled, (s, a) => {
      s.status = 'succeeded';
      s.markets = a.payload;
    });
  },
});

export const catalogReducer = slice.reducer;
