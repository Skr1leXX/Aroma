import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

// Production: Neon over HTTP (stateless, serverless friendly).
// DB_DRIVER=pg: plain node-postgres against any PostgreSQL (local development, CI, end-to-end tests).
// The placeholder keeps `next build` working without env; any real query then fails loudly.
const url = process.env.DATABASE_URL ?? "postgresql://unset:unset@unset.invalid/unset";
if (!process.env.DATABASE_URL) console.warn("[db] DATABASE_URL is not set");

const g = globalThis as unknown as { __pgPool?: Pool };

function create(): Db {
  if (process.env.DB_DRIVER === "pg") {
    g.__pgPool ??= new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 3000 });
    return drizzlePg(g.__pgPool, { schema });
  }
  return drizzleNeon(neon(url), { schema });
}

export const db: Db = create();
