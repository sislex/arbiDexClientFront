import { registerAs } from '@nestjs/config';

const IS_PRODUCTION = (process.env.NODE_ENV ?? 'development') === 'production';

/** Read a required env var; throw at boot if missing/empty (no insecure fallback). */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in the environment (see .env.example). No insecure default is provided.`,
    );
  }
  return value;
}

/** In production require the var; in dev fall back to a convenience default. */
function envOrDevDefault(name: string, devDefault: string): string {
  if (IS_PRODUCTION) return requireEnv(name);
  return process.env[name] ?? devDefault;
}

const SUPPORTED_NETWORK_PREFIXES = ['ARBITRUM', 'OPTIMISM', 'BASE'] as const;

type SupportedNetworkPrefix = (typeof SUPPORTED_NETWORK_PREFIXES)[number];

function buildNetworkConfig(prefix: SupportedNetworkPrefix) {
  return {
    rpcUrl: process.env[`${prefix}_RPC`] ?? '',
    executorAddress: process.env[`${prefix}_EXECUTOR_ADDRESS`] ?? '',
    txUrl: process.env[`${prefix}_TX_URL`] ?? '',
    /** ArbQuoter — котировки через контракт без исполнения (демо-торговля ботов). */
    quoterAddress: process.env[`${prefix}_QUOTER_ADDRESS`] ?? '',
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
  host: envOrDevDefault('DB_HOST', 'localhost'),
  port: parseInt(process.env.DB_PORT ?? '5433', 10),
  username: envOrDevDefault('DB_USER', 'arbidex'),
  password: envOrDevDefault('DB_PASSWORD', 'arbidex_pass'),
  database: envOrDevDefault('DB_NAME', 'arbidex_db'),
}));

export const jwtConfig = registerAs('jwt', () => ({
  // Secrets are mandatory in every environment — no hardcoded fallback (forgeable tokens).
  accessSecret: requireEnv('JWT_ACCESS_SECRET'),
  refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '4h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));

export const marketDataConfig = registerAs('marketData', () => ({
  // Единственный источник URL market-data. В production MARKET_DATA_URL обязателен
  // (иначе падаем на старте); в dev — дефолт на общий сервер.
  url: envOrDevDefault('MARKET_DATA_URL', 'http://45.135.182.251:3002'),
}));

export const swapNetworksConfig = registerAs('swapNetworks', () => ({
  privateKey: process.env.PRIVATE_KEY ?? '',
  networks: {
    ARBITRUM: buildNetworkConfig('ARBITRUM'),
    OPTIMISM: buildNetworkConfig('OPTIMISM'),
    BASE: buildNetworkConfig('BASE'),
  },
}));

