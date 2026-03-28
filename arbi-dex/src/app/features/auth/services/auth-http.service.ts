import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { WalletInfo, WalletProvider } from '../../../shared/models';
import { IAuthService, VerifyResponse, RefreshResponse } from './auth.service.interface';
import { API_BASE_URL } from '../../../core/config/api.config';

/** Типизация window.ethereum (MetaMask) */
interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/**
 * HTTP-реализация IAuthService.
 * Взаимодействует с бэкендом (POST /api/auth/*) и с кошельком (MetaMask и др.)
 */
@Injectable()
export class AuthHttpService extends IAuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);

  /** Подключение к кошельку — получаем адрес через window.ethereum */
  connectWallet(provider: WalletProvider): Observable<WalletInfo> {
    return from(this.requestWalletAddress(provider)).pipe(
      map((address) => ({ address: address.toLowerCase(), provider })),
    );
  }

  /** Запрос nonce с бэкенда */
  getNonce(walletAddress: string): Observable<{ nonce: string }> {
    return this.http.post<{ nonce: string }>(`${this.apiUrl}/auth/nonce`, {
      walletAddress: walletAddress.toLowerCase(),
    });
  }

  /** Подписание сообщения кошельком */
  signMessage(message: string, walletAddress: string): Observable<string> {
    if (!window.ethereum) {
      return throwError(() => new Error('Кошелёк не найден. Установите MetaMask.'));
    }
    return from(
      window.ethereum.request({
        method: 'personal_sign',
        params: [message, walletAddress.toLowerCase()],
      }) as Promise<string>,
    );
  }

  /** Верификация подписи и получение JWT-токенов */
  verifySignature(
    walletAddress: string,
    signature: string,
    walletProvider?: string,
  ): Observable<VerifyResponse> {
    return this.http.post<VerifyResponse>(`${this.apiUrl}/auth/verify`, {
      walletAddress: walletAddress.toLowerCase(),
      signature,
      walletProvider,
    });
  }

  /** Обновление токенов через refresh-токен */
  refresh(refreshToken: string): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>(`${this.apiUrl}/auth/refresh`, {
      refreshToken,
    });
  }

  // ── Private helpers ────────────────────────────────────────────────

  private async requestWalletAddress(provider: WalletProvider): Promise<string> {
    switch (provider) {
      case WalletProvider.MetaMask:
        return this.connectMetaMask();
      case WalletProvider.WalletConnect:
      case WalletProvider.CoinbaseWallet:
        throw new Error(`Провайдер ${provider} пока не поддерживается. Используйте MetaMask.`);
    }
  }

  private async connectMetaMask(): Promise<string> {
    if (!window.ethereum?.isMetaMask) {
      throw new Error('MetaMask не установлен. Установите расширение MetaMask.');
    }
    const accounts = (await window.ethereum.request({
      method: 'eth_requestAccounts',
    })) as string[];
    if (!accounts?.length) {
      throw new Error('Не удалось получить адрес кошелька из MetaMask.');
    }
    return accounts[0];
  }
}



