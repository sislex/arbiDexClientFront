/** Runtime configuration for the API layer.
 *
 * Backend URL resolution order:
 *   1. `__ARBI_API_BASE_URL__` — injected by vite.config `define` from shell env
 *      (set by `dev:live` / Playwright / vite-node). Absent under Storybook.
 *   2. `import.meta.env.VITE_API_BASE_URL` — Vite env files.
 *   3. `process.env.VITE_API_BASE_URL` — Node contexts.
 * Empty/undefined → mock mode (default, self-contained). */

function fromDefine(name: '__ARBI_API_BASE_URL__' | '__ARBI_DEV_WALLET_KEY__'): string | undefined {
  // `typeof` on an undeclared identifier is safe (no ReferenceError) — this lets
  // the same code run under Storybook where `define` isn't applied.
  if (name === '__ARBI_API_BASE_URL__') {
    return typeof __ARBI_API_BASE_URL__ !== 'undefined' ? __ARBI_API_BASE_URL__ : undefined;
  }
  return typeof __ARBI_DEV_WALLET_KEY__ !== 'undefined' ? __ARBI_DEV_WALLET_KEY__ : undefined;
}

function readEnv(key: string): string | undefined {
  try {
    const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
    if (viteEnv && viteEnv[key]) return viteEnv[key];
  } catch {
    /* import.meta.env unavailable */
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  return undefined;
}

export const API_BASE_URL = fromDefine('__ARBI_API_BASE_URL__') || readEnv('VITE_API_BASE_URL') || undefined;

export const DEV_WALLET_KEY =
  fromDefine('__ARBI_DEV_WALLET_KEY__') ||
  readEnv('VITE_DEV_WALLET_KEY') ||
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

/** Live mode when a backend base URL is configured. */
export const IS_LIVE = !!API_BASE_URL;
