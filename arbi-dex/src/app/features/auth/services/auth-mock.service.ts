import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { WalletInfo, WalletProvider } from '../../../shared/models';
import { IAuthService, VerifyResponse, RefreshResponse } from './auth.service.interface';
import { MOCK_WALLET_ADDRESS, WALLET_CONNECT_DELAY_MS } from '../../../shared/constants';

const PROVIDER_ADDRESSES: Record<WalletProvider, string> = {
  [WalletProvider.MetaMask]:      MOCK_WALLET_ADDRESS,
  [WalletProvider.WalletConnect]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [WalletProvider.CoinbaseWallet]:'0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
};

@Injectable()
export class AuthMockService extends IAuthService {
  connectWallet(provider: WalletProvider): Observable<WalletInfo> {
    const walletInfo: WalletInfo = {
      address: PROVIDER_ADDRESSES[provider],
      provider,
    };
    return of(walletInfo).pipe(delay(WALLET_CONNECT_DELAY_MS));
  }

  getNonce(_walletAddress: string): Observable<{ nonce: string }> {
    return of({ nonce: 'mock-nonce-0000' }).pipe(delay(200));
  }

  signMessage(_message: string, _walletAddress: string): Observable<string> {
    return of('0xmock_signature').pipe(delay(100));
  }

  verifySignature(
    walletAddress: string,
    _signature: string,
    walletProvider?: string,
  ): Observable<VerifyResponse> {
    return of({
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      user: {
        id: 'mock-user-id',
        walletAddress,
        walletProvider: walletProvider ?? 'MetaMask',
      },
    }).pipe(delay(300));
  }

  refresh(_refreshToken: string): Observable<RefreshResponse> {
    return of({
      accessToken: 'mock_access_token_refreshed',
      refreshToken: 'mock_refresh_token_refreshed',
    }).pipe(delay(200));
  }
}

