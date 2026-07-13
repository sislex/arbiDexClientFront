import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  toast: string | null;
}

const initialState: UiState = { toast: null };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    showToast: (s, a: PayloadAction<string>) => {
      s.toast = a.payload;
    },
    clearToast: (s) => {
      s.toast = null;
    },
  },
});

export const { showToast, clearToast } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
