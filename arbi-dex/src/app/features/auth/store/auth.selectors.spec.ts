import { TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import {
  selectIsAuthenticated,
  selectIsConnecting,
  selectWalletAddress,
  selectAuthError,
} from './auth.selectors';
import { initialAuthState } from './auth.reducer';
import { WalletProvider } from '../../../shared/models';

describe('authSelectors', () => {
  let store: MockStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({ initialState: { auth: initialAuthState } }),
      ],
    });
    store = TestBed.inject(MockStore);
  });

  it('selectIsAuthenticated should return false initially', (done) => {
    store.select(selectIsAuthenticated).subscribe((v) => {
      expect(v).toBe(false);
      done();
    });
  });

  it('selectIsConnecting should be false initially', (done) => {
    store.select(selectIsConnecting).subscribe((v) => {
      expect(v).toBe(false);
      done();
    });
  });

  it('selectWalletAddress should return address when set', (done) => {
    store.setState({
      auth: {
        ...initialAuthState,
        walletAddress: '0xABC',
        isAuthenticated: true,
        status: 'connected',
        walletProvider: WalletProvider.MetaMask,
      },
    });
    store.select(selectWalletAddress).subscribe((v) => {
      expect(v).toBe('0xABC');
      done();
    });
  });

  it('selectAuthError should return error when set', (done) => {
    store.setState({ auth: { ...initialAuthState, status: 'error', error: 'Rejected' } });
    store.select(selectAuthError).subscribe((v) => {
      expect(v).toBe('Rejected');
      done();
    });
  });
});

