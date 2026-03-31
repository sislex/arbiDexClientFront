export const APP_ROUTES = {
  LOGIN: 'login',
  DASHBOARD: 'dashboard',
  MARKET: 'market',
  SUBSCRIPTIONS: 'subscriptions',
  SUBSCRIPTION_DETAIL: 'subscriptions/:id',
  LIVE_CHART: 'subscriptions/liveChart/:id',
  PROFILE: 'profile',
} as const;

export const MOCK_WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b8D4C9B8f3e4F4B3e';

export const WALLET_CONNECT_DELAY_MS = 1500;
export const MOCK_QUOTES_LOAD_DELAY_MS = 800;
export const MOCK_CATALOG_LOAD_DELAY_MS = 500;

