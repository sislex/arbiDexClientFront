# AGENTS.md — ArbiDex

## Project Overview

ArbiDex is a crypto arbitrage monitoring platform. The repo is a **monorepo with two independent apps**:

- `arbi-dex/` — Angular 19 SPA (standalone components, NgRx, Angular Material, AG Grid, Storybook)
- `arbi-dex-server/` — NestJS 11 REST API (TypeORM + PostgreSQL, JWT auth via crypto wallet signatures)

Infrastructure is orchestrated via `docker-compose.yml` (PostgreSQL 16 + server container). The Angular app runs separately (`ng serve`, port 4200). The server listens on port 3000 with global prefix `/api`.

## Architecture & Key Patterns

### Frontend (`arbi-dex/`)

**Feature-slice structure**: each feature (`auth`, `catalog`, `quotes`, `subscriptions`, `layout`) lives under `src/app/features/<name>/` and contains three layers:
- `store/` — NgRx actions, reducer, selectors, effects (the ONLY place for state mutation)
- `services/` — abstract interface class + mock implementation (e.g., `IAuthService` / `AuthMockService`)
- `facades/` — injectable facade wrapping Store dispatch & selectors; components NEVER touch Store directly

**Mock-first development**: the frontend uses abstract service interfaces with swappable implementations. Services are configured via DI in `app.config.ts`:
```ts
// Real backend services (auth, catalog, subscriptions)
{ provide: IAuthService, useClass: AuthHttpService }
{ provide: ICatalogService, useClass: CatalogHttpService }
{ provide: ISubscriptionsService, useClass: SubscriptionsHttpService }
// Mock service (quotes — backend endpoint not yet implemented)
{ provide: IQuotesService, useClass: QuotesMockService }
```
To switch between mock and real — swap `useClass` in `app.config.ts`. Do NOT modify existing mock services. Service interfaces live in `<feature>/services/<name>.service.interface.ts`, HTTP implementations in `<feature>/services/<name>-http.service.ts`.

**HTTP layer**: `HttpClient` configured with `provideHttpClient(withInterceptors([authInterceptor]))`. The `authInterceptor` (`core/interceptors/auth.interceptor.ts`) attaches JWT Bearer token from NgRx store and dispatches `logout` on 401. API base URL via `API_BASE_URL` InjectionToken (`core/config/api.config.ts`, default `http://localhost:3000/api`).

**Auth flow (frontend)**: `connectWalletRequest` action triggers a multi-step effect chain: `connectWallet()` → `getNonce()` → `signMessage()` → `verifySignature()` → `connectWalletSuccess({ authResult })`. Tokens are persisted to `localStorage` and restored on app init via `ROOT_EFFECTS_INIT`.

**All components are standalone** — no NgModules. Every component declares its own `imports` array. Use `loadComponent` for lazy routes in `app.routes.ts`.

**Styling**: SCSS with design tokens (`src/styles/_tokens.scss`). Theme switching via `[data-theme='dark']` CSS custom properties. Use `@use 'styles/tokens' as t;` in component styles. Never hardcode colors — always use `var(--color-*)` CSS variables.

**Shared UI** (`src/app/shared/ui/`): reusable presentational components (stat-card, page-container, filter-bar, quotes-table, etc.). Models live in `src/app/shared/models/` with barrel export through `index.ts`. Constants in `src/app/shared/constants/`.

### Backend (`arbi-dex-server/`)

**Module structure**: Auth, Users, Subscriptions, Settings, Catalog. Each module follows NestJS conventions — controller, service, DTOs (`class-validator`), TypeORM entities.

**Auth flow** — Web3 wallet signature (no passwords):
1. `POST /api/auth/nonce` — get one-time nonce for wallet address
2. Client signs message `"Войти в ArbiDex\nNonce: <nonce>"` with wallet
3. `POST /api/auth/verify` — verify signature via `ethers.js`, return JWT tokens
4. Protected endpoints use `@UseGuards(JwtAuthGuard)` + `@CurrentUser()` decorator

**Config**: namespaced via `@nestjs/config` with `registerAs` in `src/config/configuration.ts` (keys: `app.*`, `db.*`, `jwt.*`). Env vars have sensible dev defaults — no `.env` file required for local development.

**Database**: TypeORM with PostgreSQL. Entities are explicitly listed in `app.module.ts`. `synchronize: true` in non-production. Seed data in `src/database/seed.ts` runs on bootstrap.

**Swagger**: auto-generated at `/api/docs`. All controllers use `@ApiTags`, `@ApiOperation`, `@ApiResponse` decorators.

## Build & Run Commands

```bash
# Frontend (from arbi-dex/)
npm start              # ng serve on port 4200
npm test               # Karma + Jasmine, headless Chrome, single run
npm run test:watch     # Karma in watch mode
npm run storybook      # Storybook dev server

# Backend (from arbi-dex-server/)
npm run start:dev      # NestJS in watch mode on port 3000
npm test               # Jest unit tests (--forceExit)
npm run test:e2e       # e2e tests (separate jest config)
npm run test:cov       # coverage report

# Infrastructure (from project root)
docker compose up -d   # PostgreSQL + server (prod build)
```

## Testing Conventions

- **Frontend**: Jasmine + Karma. Spec files colocated as `*.spec.ts`. NgRx store tests verify reducer state transitions and selector derivations separately.
- **Backend**: Jest. Spec files colocated as `*.spec.ts`. `testTimeout: 30000`. UUID and ethers ESM packages require `transformIgnorePatterns` workaround (already configured in `package.json` jest section).

## Important Conventions

1. **Barrel exports**: `shared/models/index.ts` and `shared/constants/index.ts` re-export everything. Import from barrel path (`'../shared/models'`), not individual files.
2. **Entity IDs**: all entities use UUID (`@PrimaryGeneratedColumn('uuid')`).
3. **Route constants**: defined in `shared/constants/app.constants.ts` (`APP_ROUTES`). Use these instead of string literals for navigation.
4. **AG Grid theming**: light/dark themes managed in `shared/utils/ag-grid-themes.ts`, reactive switch via `LayoutFacade.theme$`.
5. **Russian comments/descriptions**: backend Swagger descriptions and code comments are in Russian — maintain this convention.
6. **Wallet addresses**: always stored and compared as lowercase (`dto.walletAddress.toLowerCase()`).

