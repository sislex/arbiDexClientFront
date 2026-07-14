import type { AuthResult } from '../types/auth'

export const AUTH_STORAGE_KEY = 'arbidex_auth'

export function loadAuthResult(): AuthResult | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!stored) return null
    const authResult = JSON.parse(stored) as AuthResult
    if (authResult.accessToken && authResult.walletInfo?.address) {
      return authResult
    }
  } catch {
    // ignore corrupt data
  }
  return null
}

export function saveAuthResult(authResult: AuthResult): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authResult))
}

export function clearAuthResult(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}
