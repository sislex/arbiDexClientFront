import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Button, Card, CardContent, Stack, Typography, CircularProgress, Alert } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ScienceIcon from '@mui/icons-material/Science';
import { useAppDispatch, useAppSelector } from '../../store';
import { connectWallet } from '../../store/authSlice';
import { IS_LIVE } from '../../api';
import { hasMetaMask } from '../../api/auth';

/** Wallet-connect login. First successful connection auto-registers the user.
 * Offers real MetaMask (when available) and a dev test-key sign-in. */
export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, error } = useAppSelector((s) => s.auth);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const loading = status === 'loading';
  const metaMaskAvailable = hasMetaMask();

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(1200px 600px at 50% -10%, #1b2a44 0%, #0e1116 60%)',
      }}
    >
      <Card sx={{ width: 420, maxWidth: '90vw' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Typography variant="h5">ArbiDex</Typography>
            <Typography color="text.secondary">
              Автоторговля на арбитраже DEX/CEX. Войдите кошельком — при первом входе
              регистрация произойдёт автоматически.
            </Typography>
            {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}

            {/* Mock mode: a single button (no real provider). */}
            {!IS_LIVE ? (
              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AccountBalanceWalletIcon />}
                disabled={loading}
                onClick={() => dispatch(connectWallet())}
              >
                {loading ? 'Подключение…' : 'Подключить кошелёк'}
              </Button>
            ) : (
              <Stack spacing={1.5} sx={{ width: '100%' }}>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AccountBalanceWalletIcon />}
                  disabled={loading || !metaMaskAvailable}
                  onClick={() => dispatch(connectWallet('metamask'))}
                  data-testid="login-metamask"
                >
                  {loading ? 'Подключение…' : 'Подключить MetaMask'}
                </Button>
                {!metaMaskAvailable && (
                  <Typography variant="caption" color="text.secondary">
                    MetaMask не обнаружен — установите расширение или войдите dev-ключом.
                  </Typography>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  startIcon={<ScienceIcon />}
                  disabled={loading}
                  onClick={() => dispatch(connectWallet('dev'))}
                  data-testid="login-dev"
                >
                  Dev-вход (тестовый ключ)
                </Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
