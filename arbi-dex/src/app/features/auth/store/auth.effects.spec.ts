import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { Action } from '@ngrx/store';
import { AuthEffects } from './auth.effects';
import { IAuthService } from '../services/auth.service.interface';
import {
  connectWalletRequest,
  connectWalletSuccess,
  connectWalletFailure,
  logout,
} from './auth.actions';
import { WalletProvider, AuthResult } from '../../../shared/models';

describe('AuthEffects', () => {
  let actions$: Observable<Action>;
  let effects: AuthEffects;
  let authServiceSpy: jasmine.SpyObj<IAuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const walletInfo = {
    address: '0xabc',
    provider: WalletProvider.MetaMask,
  };

  const mockAuthResult: AuthResult = {
    walletInfo,
    accessToken: 'access_tok',
    refreshToken: 'refresh_tok',
    userId: 'user-123',
  };

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('IAuthService', [
      'connectWallet',
      'getNonce',
      'signMessage',
      'verifySignature',
      'refresh',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        AuthEffects,
        provideMockActions(() => actions$),
        { provide: IAuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
    effects = TestBed.inject(AuthEffects);
  });

  it('should dispatch connectWalletSuccess on successful full auth flow', (done) => {
    authServiceSpy.connectWallet.and.returnValue(of(walletInfo));
    authServiceSpy.getNonce.and.returnValue(of({ nonce: 'test-nonce' }));
    authServiceSpy.signMessage.and.returnValue(of('0xsignature'));
    authServiceSpy.verifySignature.and.returnValue(
      of({
        accessToken: 'access_tok',
        refreshToken: 'refresh_tok',
        user: { id: 'user-123', walletAddress: '0xabc', walletProvider: 'MetaMask' },
      }),
    );

    actions$ = of(connectWalletRequest({ provider: WalletProvider.MetaMask }));

    effects.connectWallet$.subscribe((action) => {
      expect(action).toEqual(connectWalletSuccess({ authResult: mockAuthResult }));
      expect(authServiceSpy.getNonce).toHaveBeenCalledWith('0xabc');
      expect(authServiceSpy.signMessage).toHaveBeenCalledWith(
        'Войти в ArbiDex\nNonce: test-nonce',
        '0xabc',
      );
      expect(authServiceSpy.verifySignature).toHaveBeenCalledWith(
        '0xabc',
        '0xsignature',
        WalletProvider.MetaMask,
      );
      done();
    });
  });

  it('should dispatch connectWalletFailure on error', (done) => {
    authServiceSpy.connectWallet.and.returnValue(
      throwError(() => new Error('Rejected')),
    );
    actions$ = of(connectWalletRequest({ provider: WalletProvider.MetaMask }));

    effects.connectWallet$.subscribe((action) => {
      expect(action).toEqual(
        connectWalletFailure({ error: 'Rejected' }),
      );
      done();
    });
  });

  it('should navigate to dashboard after login', (done) => {
    actions$ = of(connectWalletSuccess({ authResult: mockAuthResult }));

    effects.redirectAfterLogin$.subscribe(() => {
      expect(routerSpy.navigate).toHaveBeenCalledWith(['dashboard']);
      done();
    });
  });

  it('should navigate to login and clear storage after logout', (done) => {
    spyOn(localStorage, 'removeItem');
    actions$ = of(logout());

    effects.logoutCleanup$.subscribe(() => {
      expect(routerSpy.navigate).toHaveBeenCalledWith(['login']);
      expect(localStorage.removeItem).toHaveBeenCalledWith('arbidex_auth');
      done();
    });
  });
});

