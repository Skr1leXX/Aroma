import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { db, type Db } from "./index";
import * as schema from "./schema";

// The HTTP driver (src/db/index.ts) cannot run interactive transactions. Booking needs
// "lock -> check capacity -> insert" to be atomic, so this WebSocket pool is used for that only.
if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

let pool: Pool | undefined;

export function getTxDb(): Db {
  if (process.env.DB_DRIVER === "pg") return db; // node-postgres pool already supports transactions
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  return drizzle(pool, { schema });
}
