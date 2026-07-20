import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UndoDeleteProvider } from './context/UndoDeleteContext'
import { AppPreferencesProvider } from './context/AppPreferencesContext'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Layout } from './components/layout/Layout'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { TradingPairsPage } from './pages/TradingPairs'
import { TradingPairEditorPage } from './pages/TradingPairEditorPage'
import { StrategiesPage } from './pages/Strategies'
import { StrategyEditorPage } from './pages/StrategyEditorPage'
import { BotsPage } from './pages/Bots'
import { BotEditorPage } from './pages/BotEditorPage'
import { BotEditRoute } from './pages/BotEditRoute'
import { BotDetailPage } from './pages/BotDetail'
import { BotHistoryPage } from './pages/BotHistory'
import { LiveTradingPage } from './pages/LiveTrading'
import { PairChartPage } from './pages/PairChartPage'
import { AnalyticsPage } from './pages/Analytics'
import { HistoryPage } from './pages/History'
import { SettingsPage } from './pages/Settings'

export default function App() {
  return (
    <AppPreferencesProvider>
      <UndoDeleteProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="chart/:id" element={<PairChartPage />} />
                <Route element={<Layout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="pairs/new" element={<TradingPairEditorPage />} />
                  <Route path="pairs/:id/edit" element={<TradingPairEditorPage />} />
                  <Route path="pairs" element={<TradingPairsPage />} />
                  <Route path="strategies/new" element={<StrategyEditorPage />} />
                  <Route path="strategies/:id/edit" element={<StrategyEditorPage />} />
                  <Route path="strategies" element={<StrategiesPage />} />
                  <Route path="bots/new" element={<BotEditorPage />} />
                  <Route path="bots/:id/edit" element={<BotEditRoute />} />
                  <Route path="bots" element={<BotsPage />} />
                  <Route path="bots/:id/history" element={<BotHistoryPage />} />
                  <Route path="bots/:id" element={<BotDetailPage />} />
                  <Route path="live" element={<LiveTradingPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </UndoDeleteProvider>
    </AppPreferencesProvider>
  )
}
