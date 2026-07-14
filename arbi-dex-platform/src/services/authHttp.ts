import { WalletProvider, type VerifyResponse, type WalletInfo } from '../types/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, init)
  } catch {
    throw new Error(
      'Сервер недоступен. Запустите arbi-dex-server на порту 3006 (docker compose up server в arbiDexClientFront).',
    )
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] }
    if (Array.isArray(data.message)) return data.message.join(', ')
    if (typeof data.message === 'string') return data.message
  } catch {
    // ignore parse errors
  }
  return fallback
}

async function connectMetaMask(): Promise<string> {
  if (!window.ethereum?.isMetaMask) {
    throw new Error('MetaMask не установлен. Установите расширение MetaMask.')
  }
  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[]
  if (!accounts?.length) {
    throw new Error('Не удалось получить адрес кошелька из MetaMask.')
  }
  return accounts[0]
}

async function requestWalletAddress(provider: WalletProvider): Promise<string> {
  switch (provider) {
    case WalletProvider.MetaMask:
      return connectMetaMask()
    case WalletProvider.WalletConnect:
    case WalletProvider.CoinbaseWallet:
      throw new Error(`Провайдер ${provider} пока не поддерживается. Используйте MetaMask.`)
  }
}

export async function connectWallet(provider: WalletProvider): Promise<WalletInfo> {
  const address = await requestWalletAddress(provider)
  return { address: address.toLowerCase(), provider }
}

export async function getNonce(walletAddress: string): Promise<{ nonce: string }> {
  const response = await apiFetch('/auth/nonce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: walletAddress.toLowerCase() }),
  })
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Не удалось получить nonce с сервера.'))
  }
  return response.json() as Promise<{ nonce: string }>
}

export async function signMessage(message: string, walletAddress: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error('Кошелёк не найден. Установите MetaMask.')
  }
  return window.ethereum.request({
    method: 'personal_sign',
    params: [message, walletAddress.toLowerCase()],
  }) as Promise<string>
}

export async function verifySignature(
  walletAddress: string,
  signature: string,
  walletProvider?: string,
): Promise<VerifyResponse> {
  const response = await apiFetch('/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: walletAddress.toLowerCase(),
      signature,
      walletProvider,
    }),
  })
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Не удалось верифицировать подпись на сервере.'))
  }
  return response.json() as Promise<VerifyResponse>
}
