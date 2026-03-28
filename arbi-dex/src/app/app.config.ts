import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { isDevMode } from '@angular/core';

import { routes } from './app.routes';

// Reducers
import { authReducer, AUTH_FEATURE_KEY } from './features/auth/store/auth.reducer';
import { catalogReducer, CATALOG_FEATURE_KEY } from './features/catalog/store/catalog.reducer';
import { subscriptionsReducer, SUBSCRIPTIONS_FEATURE_KEY } from './features/subscriptions/store/subscriptions.reducer';
import { quotesReducer, QUOTES_FEATURE_KEY } from './features/quotes/store/quotes.reducer';
import { layoutReducer, LAYOUT_FEATURE_KEY } from './features/layout/store/layout.reducer';

// Effects
import { AuthEffects } from './features/auth/store/auth.effects';
import { CatalogEffects } from './features/catalog/store/catalog.effects';
import { SubscriptionsEffects } from './features/subscriptions/store/subscriptions.effects';
import { QuotesEffects } from './features/quotes/store/quotes.effects';

// Mock Services
import { IAuthService } from './features/auth/services/auth.service.interface';
import { AuthMockService } from './features/auth/services/auth-mock.service';
import { ICatalogService, CatalogMockService } from './features/catalog/services/catalog-mock.service';
import { IQuotesService, QuotesMockService } from './features/quotes/services/quotes-mock.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    provideStore({
      [AUTH_FEATURE_KEY]: authReducer,
      [CATALOG_FEATURE_KEY]: catalogReducer,
      [SUBSCRIPTIONS_FEATURE_KEY]: subscriptionsReducer,
      [QUOTES_FEATURE_KEY]: quotesReducer,
      [LAYOUT_FEATURE_KEY]: layoutReducer,
    }),
    provideEffects([AuthEffects, CatalogEffects, SubscriptionsEffects, QuotesEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
    // Mock services — swap these for real implementations when ready
    { provide: IAuthService, useClass: AuthMockService },
    { provide: ICatalogService, useClass: CatalogMockService },
    { provide: IQuotesService, useClass: QuotesMockService },
  ],
};
