import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { WalletProvider } from '../../../shared/models';
import {
  connectWalletRequest,
  logout,
} from '../store/auth.actions';
import {
  selectIsAuthenticated,
  selectIsConnecting,
  selectWalletAddress,
  selectWalletProvider,
  selectAuthStatus,
  selectAuthError,
} from '../store/auth.selectors';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly store = inject(Store);

  readonly isAuthenticated$ = this.store.select(selectIsAuthenticated);
  readonly isConnecting$ = this.store.select(selectIsConnecting);
  readonly walletAddress$ = this.store.select(selectWalletAddress);
  readonly walletProvider$ = this.store.select(selectWalletProvider);
  readonly authStatus$ = this.store.select(selectAuthStatus);
  readonly authError$ = this.store.select(selectAuthError);

  connect(provider: WalletProvider): void {
    this.store.dispatch(connectWalletRequest({ provider }));
  }

  logout(): void {
    this.store.dispatch(logout());
  }
}

