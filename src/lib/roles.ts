export class ForbiddenError extends Error {}

export type Role = "customer" | "admin";

/** The single rule behind every admin gate: no user, or any role except admin, is refused. */
export function assertAdminUser<T extends { role: Role }>(user: T | null | undefined): T {
  if (user?.role !== "admin") throw new ForbiddenError("Forbidden");
  return user;
}
