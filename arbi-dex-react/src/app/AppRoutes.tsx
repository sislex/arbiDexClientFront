import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { AppShell } from './AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { MarketConfigsPage } from '../features/marketConfigs/MarketConfigsPage';
import { MarketConfigEditorPage } from '../features/marketConfigs/MarketConfigEditorPage';
import { StrategiesPage } from '../features/strategies/StrategiesPage';
import { StrategyEditorPage } from '../features/strategies/StrategyEditorPage';
import { BotDetailPage } from '../features/bots/BotDetailPage';
import { AddBotPage } from '../features/bots/AddBotPage';
import { BotsPage } from '../features/bots/BotsPage';
import { EditBotPage } from '../features/bots/EditBotPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/market-configs" element={<MarketConfigsPage />} />
        <Route path="/market-configs/new" element={<MarketConfigEditorPage />} />
        <Route path="/market-configs/:id" element={<MarketConfigEditorPage />} />
        <Route path="/strategies" element={<StrategiesPage />} />
        <Route path="/strategies/new" element={<StrategyEditorPage />} />
        <Route path="/strategies/:id" element={<StrategyEditorPage />} />
        <Route path="/bots" element={<BotsPage />} />
        <Route path="/bots/new" element={<AddBotPage />} />
        <Route path="/bots/:id" element={<BotDetailPage />} />
        <Route path="/bots/:id/edit" element={<EditBotPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
