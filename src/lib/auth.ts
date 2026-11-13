import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPg = PgDatabase<any, typeof schema>;

/** Factory so local verification can run the same config on an in-process Postgres (PGlite). */
export function createAuth(db: AnyPg, mail: typeof sendEmail = sendEmail) {
  return betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  advanced: { database: { generateId: "uuid" } },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited: avoids timing differences that reveal whether an email exists.
      void mail({
        to: user.email,
        subject: "Aroma: восстановление пароля",
        text: `Чтобы задать новый пароль, перейдите по ссылке (действует 1 час):\n${url}`,
      });
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
  // No `additionalFields`: the client cannot send a role. Roles live in user_roles,
  // and are written only here (customer) or by the admin seed script (admin).
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.insert(schema.profiles).values({ userId: user.id, fullName: user.name }).onConflictDoNothing();
          await db.insert(schema.userRoles).values({ userId: user.id, role: "customer" }).onConflictDoNothing();
        },
      },
    },
  },
  plugins: [nextCookies()], // must be last
  });
}

export const auth = createAuth(db);

export async function getUserRole(userId: string, database: AnyPg = db) {
  const [row] = await database.select({ role: schema.userRoles.role }).from(schema.userRoles).where(eq(schema.userRoles.userId, userId));
  return row?.role ?? "customer";
}
