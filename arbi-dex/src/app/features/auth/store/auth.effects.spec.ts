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
import { WalletProvider } from '../../../shared/models';

describe('AuthEffects', () => {
  let actions$: Observable<Action>;
  let effects: AuthEffects;
  let authServiceSpy: jasmine.SpyObj<IAuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('IAuthService', ['connectWallet']);
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

  it('should dispatch connectWalletSuccess on successful connection', (done) => {
    const walletInfo = {
      address: '0xABC',
      provider: WalletProvider.MetaMask,
    };
    authServiceSpy.connectWallet.and.returnValue(of(walletInfo));
    actions$ = of(connectWalletRequest({ provider: WalletProvider.MetaMask }));

    effects.connectWallet$.subscribe((action) => {
      expect(action).toEqual(connectWalletSuccess({ walletInfo }));
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
        connectWalletFailure({ error: 'Error: Rejected' }),
      );
      done();
    });
  });

  it('should navigate to dashboard after login', (done) => {
    const walletInfo = { address: '0xABC', provider: WalletProvider.MetaMask };
    actions$ = of(connectWalletSuccess({ walletInfo }));

    effects.redirectAfterLogin$.subscribe(() => {
      expect(routerSpy.navigate).toHaveBeenCalledWith(['dashboard']);
      done();
    });
  });

  it('should navigate to login after logout', (done) => {
    actions$ = of(logout());

    effects.redirectAfterLogout$.subscribe(() => {
      expect(routerSpy.navigate).toHaveBeenCalledWith(['login']);
      done();
    });
  });
});

