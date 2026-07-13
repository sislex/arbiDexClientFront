import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { store } from './store';
import { theme } from './theme';
import { App } from './App';
import { IS_LIVE } from './api';
import { getStoredAuth } from './api/http';
import { restoreSession } from './store/authSlice';

// In live mode, restore a persisted session so a reload keeps the user logged in.
if (IS_LIVE) {
  const stored = getStoredAuth();
  if (stored?.accessToken) {
    store.dispatch(
      restoreSession({ address: stored.walletInfo.address, token: stored.accessToken, isNew: false }),
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>,
);
