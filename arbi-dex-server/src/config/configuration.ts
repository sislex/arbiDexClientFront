import { registerAs } from '@nestjs/config';

const SUPPORTED_NETWORK_PREFIXES = ['ARBITRUM', 'OPTIMISM', 'BASE'] as const;

type SupportedNetworkPrefix = (typeof SUPPORTED_NETWORK_PREFIXES)[number];

function buildNetworkConfig(prefix: SupportedNetworkPrefix) {
  return {
    rpcUrl: process.env[`${prefix}_RPC`] ?? '',
    executorAddress: process.env[`${prefix}_EXECUTOR_ADDRESS`] ?? '',
    txUrl: process.env[`${prefix}_TX_URL`] ?? '',
    routers: {
      uniswapV2: process.env[`${prefix}_UNISWAP_V2_ROUTER`] ?? '',
      sushiV2: process.env[`${prefix}_SUSHI_V2_ROUTER`] ?? '',
      camelotV2: process.env[`${prefix}_CAMELOT_V2_ROUTER`] ?? '',
    },
  };
}

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT ?? '3006', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
}));

export const dbConfig = registerAs('db', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5433', 10),
  username: process.env.DB_USER ?? 'arbidex',
  password: process.env.DB_PASSWORD ?? 'arbidex_pass',
  database: process.env.DB_NAME ?? 'arbidex_db',
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '4h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));

export const marketDataConfig = registerAs('marketData', () => ({
  url: process.env.MARKET_DATA_URL ?? 'http://45.135.182.251:3002',
}));

export const swapNetworksConfig = registerAs('swapNetworks', () => ({
  privateKey: process.env.PRIVATE_KEY ?? '',
  networks: {
    ARBITRUM: buildNetworkConfig('ARBITRUM'),
    OPTIMISM: buildNetworkConfig('OPTIMISM'),
    BASE: buildNetworkConfig('BASE'),
  },
}));

