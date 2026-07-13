/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL incl. /api prefix. When set → live mode; empty → mock. */
  readonly VITE_API_BASE_URL?: string;
  /** Deterministic dev wallet private key for headless login. */
  readonly VITE_DEV_WALLET_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by vite.config `define` from shell env (empty when unset). */
declare const __ARBI_API_BASE_URL__: string;
declare const __ARBI_DEV_WALLET_KEY__: string;

/** Minimal EIP-1193 provider (MetaMask & co.). */
interface EthereumProvider {
  isMetaMask?: boolean;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}
interface Window {
  ethereum?: EthereumProvider;
}
