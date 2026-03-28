import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { WalletInfo, WalletProvider } from '../../../shared/models';
import { IAuthService } from './auth.service.interface';
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
}

