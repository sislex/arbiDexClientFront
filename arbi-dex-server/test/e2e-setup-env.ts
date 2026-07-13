/**
 * Route the whole e2e suite to a dedicated, isolated database.
 *
 * `app.e2e-spec.ts` connects with `dropSchema: true`, which drops every table on
 * boot — running that against the dev/prod database (`arbidex_db`) wipes real
 * data. Both e2e specs read `process.env.DB_NAME`, so forcing it here (before the
 * NestJS ConfigModule / TypeORM read it) keeps e2e off the dev database entirely.
 *
 * Uses `E2E_DB_NAME` when set, otherwise `arbidex_e2e`. This deliberately ignores
 * any ambient `DB_NAME` so a stray dev value can never point e2e back at dev data.
 */
process.env.DB_NAME = process.env.E2E_DB_NAME ?? 'arbidex_e2e';
