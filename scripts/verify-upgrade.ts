// Checks that migration 0001 upgrades a database that already holds old-style data.  npm run verify:upgrade
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const run = async (pg: PGlite, file: string) => {
  for (const stmt of readFileSync(file, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await pg.exec(stmt);
};

async function main() {
  const pg = new PGlite();
  await run(pg, "drizzle/0000_init.sql");
  await pg.exec(`insert into reservations (name, phone, email, reservation_date, reservation_time, guests, status)
                 values ('Old', '+7 900 000 0000', 'old@example.com', '2030-01-01', '19:30', 2, 'new')`);
  await pg.exec(`insert into restaurant_settings (id, phone, email, address, hours) values (1, 'p', 'e@e.e', 'addr', '[]')`);
  await run(pg, "drizzle/0001_booking_engine.sql");
  await run(pg, "drizzle/0002_admin_panel.sql");
  const r = await pg.query<{ status: string; start_minute: number; duration_minutes: number }>("select status, start_minute, duration_minutes from reservations");
  const s = await pg.query<{ seating_capacity: number; auto_confirm: boolean; name: string; social: unknown[] }>("select seating_capacity, auto_confirm, name, social from restaurant_settings");
  const ok = r.rows[0]?.status === "pending" && r.rows[0].start_minute === 1170 && r.rows[0].duration_minutes === 120 && s.rows[0]?.seating_capacity === 40 && s.rows[0].auto_confirm === false && s.rows[0].name === "Aroma" && s.rows[0].social.length === 0;
  console.log(ok ? "PASS  0001 + 0002 upgrade existing data (new -> pending, defaults filled)" : `FAIL  ${JSON.stringify([r.rows, s.rows])}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
