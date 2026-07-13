import { createTheme } from '@mui/material/styles';

/** Dark trading-dashboard theme. */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4f8cff' },
    success: { main: '#26a35a' },
    error: { main: '#e2445c' },
    warning: { main: '#e0a12f' },
    background: { default: '#0e1116', paper: '#161b22' },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSize: 13,
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
    MuiCard: { styleOverrides: { root: { border: '1px solid rgba(255,255,255,0.08)' } } },
  },
});
