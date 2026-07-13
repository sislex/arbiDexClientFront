/**
 * Jest globalSetup for the e2e suite: ensure the isolated e2e database exists
 * before any spec connects (TypeORM does not create databases, only schemas).
 *
 * Connects to the `postgres` maintenance database and issues `CREATE DATABASE`,
 * ignoring the "already exists" error. Connection params come from the same env
 * vars the app uses (DB_HOST / DB_PORT / DB_USER / DB_PASSWORD).
 */
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
export default async function globalSetup(): Promise<void> {
  const { Client } = require('pg');
  const dbName = process.env.E2E_DB_NAME ?? 'arbidex_e2e';

  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5433', 10),
    user: process.env.DB_USER ?? 'arbidex',
    password: process.env.DB_PASSWORD ?? 'arbidex_pass',
    database: 'postgres',
  });

  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`[e2e] created isolated database "${dbName}"`);
  } catch (err) {
    // 42P04 = duplicate_database — already there, nothing to do.
    if ((err as { code?: string }).code !== '42P04') throw err;
  } finally {
    await client.end();
  }
}
