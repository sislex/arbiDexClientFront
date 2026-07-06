import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { of, Subject } from 'rxjs';

import { authInterceptor } from './auth.interceptor';
import { IAuthService, RefreshResponse } from '../../features/auth/services/auth.service.interface';
import { selectAccessToken, selectRefreshToken } from '../../features/auth/store/auth.selectors';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let dispatch: jasmine.Spy;
  let refresh: jasmine.Spy;
  let accessToken: string | null;
  let refreshToken: string | null;

  function configure(): void {
    dispatch = jasmine.createSpy('dispatch');
    const store = {
      select: (sel: unknown) => {
        if (sel === selectAccessToken) return of(accessToken);
        if (sel === selectRefreshToken) return of(refreshToken);
        return of(null);
      },
      dispatch,
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Store, useValue: store },
        { provide: IAuthService, useValue: { refresh } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    accessToken = 'access-1';
    refreshToken = 'refresh-1';
    refresh = jasmine.createSpy('refresh');
  });

  afterEach(() => httpMock.verify());

  it('attaches the access token to non-auth requests', () => {
    configure();
    http.get('/api/data').subscribe();
    const req = httpMock.expectOne('/api/data');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({});
  });

  it('does not attach the token to auth requests', () => {
    configure();
    http.post('/api/auth/nonce', {}).subscribe();
    const req = httpMock.expectOne('/api/auth/nonce');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('on 401 refreshes then retries the original request with the new token', () => {
    refresh.and.returnValue(of<RefreshResponse>({ accessToken: 'access-2', refreshToken: 'refresh-2' }));
    configure();
    const done = jasmine.createSpy('next');
    http.get('/api/data').subscribe(done);

    httpMock.expectOne('/api/data').flush({}, { status: 401, statusText: 'Unauthorized' });

    const retried = httpMock.expectOne('/api/data');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer access-2');
    retried.flush({ ok: true });

    expect(done).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalled(); // refreshTokenSuccess
  });

  it('when refresh fails, a queued second request errors instead of hanging (M1 fix)', () => {
    const refreshSubject = new Subject<RefreshResponse>();
    refresh.and.returnValue(refreshSubject.asObservable());
    configure();

    const errors: string[] = [];
    http.get('/api/a').subscribe({ error: () => errors.push('a') });
    http.get('/api/b').subscribe({ error: () => errors.push('b') });

    // A becomes the refresher; B queues waiting for the new token.
    httpMock.expectOne('/api/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/b').flush({}, { status: 401, statusText: 'Unauthorized' });

    // Refresh fails → both the refresher and the queued waiter must error, not hang.
    refreshSubject.error(new Error('refresh failed'));

    expect(errors).toContain('a');
    expect(errors).toContain('b');
    expect(dispatch).toHaveBeenCalled(); // logout
  });
});
