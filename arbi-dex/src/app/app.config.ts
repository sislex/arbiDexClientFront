import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
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
import { demoAccountReducer, DEMO_ACCOUNT_FEATURE_KEY } from './features/demo-account/store/demo-account.reducer';
import { arbiConfigsReducer, ARBI_CONFIGS_FEATURE_KEY } from './features/arbi-configs/store/arbi-configs.reducer';

// Effects
import { AuthEffects } from './features/auth/store/auth.effects';
import { CatalogEffects } from './features/catalog/store/catalog.effects';
import { SubscriptionsEffects } from './features/subscriptions/store/subscriptions.effects';
import { QuotesEffects } from './features/quotes/store/quotes.effects';
import { DemoAccountEffects } from './features/demo-account/store/demo-account.effects';
import { ArbiConfigsEffects } from './features/arbi-configs/store/arbi-configs.effects';

// Interceptors
import { authInterceptor } from './core/interceptors/auth.interceptor';

// Service interfaces
import { IAuthService } from './features/auth/services/auth.service.interface';
import { ICatalogService } from './features/catalog/services/catalog.service.interface';
import { IQuotesService } from './features/quotes/services/quotes.service.interface';
import { ISubscriptionsService } from './features/subscriptions/services/subscriptions.service.interface';
import { IPricesService } from './features/subscriptions/services/prices.service.interface';
import { IArbiConfigsService } from './features/arbi-configs/services/arbi-configs.service.interface';

// HTTP service implementations (backend integration)
import { AuthHttpService } from './features/auth/services/auth-http.service';
import { CatalogHttpService } from './features/catalog/services/catalog-http.service';
import { SubscriptionsHttpService } from './features/subscriptions/services/subscriptions-http.service';
import { PricesHttpService } from './features/subscriptions/services/prices-http.service';
import { QuotesHttpService } from './features/quotes/services/quotes-http.service';
import { ArbiConfigsHttpService } from './features/arbi-configs/services/arbi-configs-http.service';

// Unused mock kept for reference:
// import { QuotesMockService } from './features/quotes/services/quotes-mock.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideStore({
      [AUTH_FEATURE_KEY]: authReducer,
      [CATALOG_FEATURE_KEY]: catalogReducer,
      [SUBSCRIPTIONS_FEATURE_KEY]: subscriptionsReducer,
      [QUOTES_FEATURE_KEY]: quotesReducer,
      [LAYOUT_FEATURE_KEY]: layoutReducer,
      [DEMO_ACCOUNT_FEATURE_KEY]: demoAccountReducer,
      [ARBI_CONFIGS_FEATURE_KEY]: arbiConfigsReducer,
    }),
    provideEffects([AuthEffects, CatalogEffects, SubscriptionsEffects, QuotesEffects, DemoAccountEffects, ArbiConfigsEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
    // ── Сервисы ─────────────────────────────────────────────────────
    // Auth, Catalog, Subscriptions → реальный бэкенд
    { provide: IAuthService, useClass: AuthHttpService },
    { provide: ICatalogService, useClass: CatalogHttpService },
    { provide: ISubscriptionsService, useClass: SubscriptionsHttpService },
    { provide: IPricesService, useClass: PricesHttpService },
    // Quotes → реальный бэкенд (arbiDexMarketData snapshot)
    { provide: IQuotesService, useClass: QuotesHttpService },
    // ArbiConfigs → реальный бэкенд
    { provide: IArbiConfigsService, useClass: ArbiConfigsHttpService },
  ],
};
