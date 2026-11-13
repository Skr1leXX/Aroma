// Creates (or promotes) the first administrator. Run on a trusted machine with DB access:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-secret' npm run admin:create
// This is the ONLY place the "admin" role is granted; signup and clients can never set it.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userRoles, users } from "@/db/schema";
import { auth } from "@/lib/auth";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Администратор";
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");

  let [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) {
    await auth.api.signUpEmail({ body: { name, email, password } });
    [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  }
  await db
    .insert(userRoles)
    .values({ userId: user.id, role: "admin" })
    .onConflictDoUpdate({ target: userRoles.userId, set: { role: "admin" } });
  console.log(`Admin ready: ${email}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
