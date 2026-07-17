import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
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
  Collapse,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TuneIcon from '@mui/icons-material/Tune';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import MemoryIcon from '@mui/icons-material/Memory';
import SettingsIcon from '@mui/icons-material/Settings';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import TokenIcon from '@mui/icons-material/Token';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAppDispatch, useAppSelector } from '../store';
import { logout } from '../store/authSlice';

const DRAWER_WIDTH = 232;

const NAV = [
  { to: '/dashboard', label: 'Дашборд', icon: <DashboardIcon /> },
  { to: '/market-configs', label: 'Конфигурации рынков', icon: <ShowChartIcon /> },
  { to: '/strategies', label: 'Стратегии', icon: <TuneIcon /> },
  { to: '/bots', label: 'Боты', icon: <SmartToyIcon /> },
  { to: '/computations', label: 'Расчёты', icon: <MemoryIcon /> },
];

/** Подменю «Настройки»: квотеры, экзекутеры, токены, вычисления. */
const SETTINGS_NAV = [
  { to: '/settings/quoters', label: 'Квотеры', icon: <RequestQuoteIcon fontSize="small" /> },
  { to: '/settings/executors', label: 'Экзекутеры', icon: <RocketLaunchIcon fontSize="small" /> },
  { to: '/settings/tokens', label: 'Сопоставление токенов', icon: <TokenIcon fontSize="small" /> },
  { to: '/settings/compute', label: 'Вычисления', icon: <MemoryIcon fontSize="small" /> },
];

/** Authenticated layout: fixed sidebar nav + topbar with wallet & logout. */
export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  // Подменю настроек раскрыто, пока пользователь внутри одного из его разделов.
  const [settingsOpen, setSettingsOpen] = useState(location.pathname.startsWith('/settings'));

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

          {/* «Настройки» — раскрывающееся подменю */}
          <ListItemButton
            onClick={() => setSettingsOpen((v) => !v)}
            sx={{ borderRadius: 2, mb: 0.5 }}
            data-testid="nav-settings"
          >
            <ListItemIcon sx={{ minWidth: 38 }}>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Настройки" primaryTypographyProps={{ fontSize: 14 }} />
            {settingsOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </ListItemButton>
          <Collapse in={settingsOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {SETTINGS_NAV.map((item) => (
                <ListItemButton
                  key={item.to}
                  selected={location.pathname.startsWith(item.to)}
                  onClick={() => navigate(item.to)}
                  sx={{ borderRadius: 2, mb: 0.5, pl: 4 }}
                  data-testid={`nav-${item.to.split('/').pop()}`}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13 }} />
                </ListItemButton>
              ))}
            </List>
          </Collapse>
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
