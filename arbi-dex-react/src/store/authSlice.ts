import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../domain/types';
import type { WalletMethod } from '../api/types';
import { api } from '../api';

export type Status = 'idle' | 'loading' | 'succeeded' | 'failed';

interface AuthState {
  user: User | null;
  status: Status;
  error: string | null;
}

const initialState: AuthState = { user: null, status: 'idle', error: null };

export const connectWallet = createAsyncThunk('auth/connectWallet', (method?: WalletMethod) =>
  api.auth.connectWallet(method),
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (s) => {
      s.user = null;
      s.status = 'idle';
    },
    restoreSession: (s, a: PayloadAction<User>) => {
      s.user = a.payload;
      s.status = 'succeeded';
    },
  },
  extraReducers: (b) => {
    b.addCase(connectWallet.pending, (s) => {
      s.status = 'loading';
      s.error = null;
    });
    b.addCase(connectWallet.fulfilled, (s, a) => {
      s.status = 'succeeded';
      s.user = a.payload;
    });
    b.addCase(connectWallet.rejected, (s, a) => {
      s.status = 'failed';
      s.error = a.error.message ?? 'Ошибка авторизации';
    });
  },
});

export const { logout, restoreSession } = authSlice.actions;
export const authReducer = authSlice.reducer;
