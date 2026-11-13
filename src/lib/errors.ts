/** An expected, user-presentable failure (validation of business rules, conflicts). Its message is safe to show. */
export class UserError extends Error {}

/** Postgres unique_violation, whether raised by neon-http, the pool or PGlite (possibly wrapped by Drizzle). */
export function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) => (x as { code?: string } | undefined)?.code;
  return code(e) === "23505" || code((e as { cause?: unknown } | undefined)?.cause) === "23505";
}
