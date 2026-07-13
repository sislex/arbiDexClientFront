import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  Chip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TuneIcon from '@mui/icons-material/Tune';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAppDispatch, useAppSelector } from '../store';
import { logout } from '../store/authSlice';

const DRAWER_WIDTH = 232;

const NAV = [
  { to: '/dashboard', label: 'Дашборд', icon: <DashboardIcon /> },
  { to: '/market-configs', label: 'Конфигурации рынков', icon: <ShowChartIcon /> },
  { to: '/strategies', label: 'Стратегии', icon: <TuneIcon /> },
  { to: '/bots/new', label: 'Добавить бота', icon: <AddCircleIcon /> },
];

/** Authenticated layout: fixed sidebar nav + topbar with wallet & logout. */
export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid rgba(255,255,255,0.08)' },
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
            Arbi<span style={{ color: '#4f8cff' }}>Dex</span>
          </Typography>
        </Toolbar>
        <List sx={{ px: 1 }}>
          {NAV.map((item) => {
            const selected =
              location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
            return (
              <ListItemButton
                key={item.to}
                selected={selected}
                onClick={() => navigate(item.to)}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 38 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Toolbar sx={{ gap: 2, justifyContent: 'flex-end' }}>
            {user && (
              <Chip
                label={`${user.address.slice(0, 6)}…${user.address.slice(-4)}`}
                variant="outlined"
                size="small"
              />
            )}
            <Button
              startIcon={<LogoutIcon />}
              size="small"
              color="inherit"
              onClick={() => {
                dispatch(logout());
                navigate('/login', { replace: true });
              }}
            >
              Выйти
            </Button>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flexGrow: 1, p: 3, maxWidth: 1400, width: '100%', mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
