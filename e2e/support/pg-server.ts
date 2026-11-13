// Starts a REAL PostgreSQL (embedded-postgres binaries) for tests, applies the Drizzle migrations
// with the same migrator drizzle-kit uses, seeds demo data and creates the test users.
// Used by Playwright's webServer and by the DB tests.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import * as s from "../../src/db/schema";
import { seed } from "../../src/db/seed";
import { createAuth } from "../../src/lib/auth";

export const PG_PORT = Number(process.env.E2E_PG_PORT ?? 54329);
export const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/aroma_test`;

export const ADMIN = { name: "Админ Тест", email: "admin@aroma.test", password: "admin-password-123" };
export const CUSTOMER = { name: "Гость Тест", email: "guest@aroma.test", password: "guest-password-123" };

process.env.BETTER_AUTH_SECRET ??= "e2e-secret-0123456789abcdef0123456789abcdef";

export async function startPg() {
  const pg = new EmbeddedPostgres({
    databaseDir: mkdtempSync(join(tmpdir(), "aroma-pg-")),
    user: "postgres",
    password: "postgres",
    port: PG_PORT,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("aroma_test");
  return pg;
}

export async function prepare() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema: s });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seed(db);

  const auth = createAuth(db);
  for (const u of [ADMIN, CUSTOMER]) await auth.api.signUpEmail({ body: u });
  const [admin] = await db.select().from(s.users).where(eq(s.users.email, ADMIN.email));
  await db.update(s.userRoles).set({ role: "admin" }).where(eq(s.userRoles.userId, admin.id));
  await pool.end();
}
