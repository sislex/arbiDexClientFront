import { Wallet } from 'ethers';
import type { User } from '../domain/types';
import type { WalletMethod } from './types';
import { DEV_WALLET_KEY } from './config';
import { request, setStoredAuth } from './http';

interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; walletAddress: string; walletProvider?: string };
}

/** True when an injected EIP-1193 provider (MetaMask) is available. */
export function hasMetaMask(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

/** Shared tail: nonce → (already-signed) → verify → persist tokens → User. */
async function verifyAndStore(address: string, signature: string, provider: string): Promise<User> {
  const verify = await request<VerifyResponse>('/auth/verify', {
    method: 'POST',
    body: { walletAddress: address, signature, walletProvider: provider },
    noAuth: true,
  });
  setStoredAuth({
    walletInfo: { address, provider },
    accessToken: verify.accessToken,
    refreshToken: verify.refreshToken,
    userId: verify.user.id,
  });
  return { address, token: verify.accessToken, isNew: false };
}

async function getNonce(address: string): Promise<string> {
  const { nonce } = await request<{ nonce: string }>('/auth/nonce', {
    method: 'POST',
    body: { walletAddress: address },
    noAuth: true,
  });
  return nonce;
}

const message = (nonce: string) => `Войти в ArbiDex\nNonce: ${nonce}`;

/**
 * Dev wallet login: signs the nonce with a deterministic test key via ethers
 * (headless-friendly; mirrors e2e/make-auth-state.mjs).
 */
export async function connectWithDevKey(): Promise<User> {
  const wallet = new Wallet(DEV_WALLET_KEY);
  const address = wallet.address.toLowerCase();
  const nonce = await getNonce(address);
  const signature = await wallet.signMessage(message(nonce));
  return verifyAndStore(address, signature, 'MetaMask');
}

/**
 * Real MetaMask login via the injected EIP-1193 provider: requests accounts,
 * signs the nonce with `personal_sign`, then verifies (same as the Angular app).
 */
export async function connectWithMetaMask(): Promise<User> {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!eth) throw new Error('MetaMask не найден. Установите расширение или используйте dev-вход.');
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
  const address = (accounts?.[0] ?? '').toLowerCase();
  if (!address) throw new Error('Кошелёк не вернул адрес');
  const nonce = await getNonce(address);
  const signature = (await eth.request({ method: 'personal_sign', params: [message(nonce), address] })) as string;
  return verifyAndStore(address, signature, 'MetaMask');
}

/** Live login dispatcher. Explicit method wins; otherwise MetaMask if present, else dev key. */
export function connectWalletLive(method?: WalletMethod): Promise<User> {
  const chosen: WalletMethod = method ?? (hasMetaMask() ? 'metamask' : 'dev');
  return chosen === 'metamask' ? connectWithMetaMask() : connectWithDevKey();
}
