import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, getUserRole } from "@/lib/auth";
import { assertAdminUser, ForbiddenError, type Role } from "@/lib/roles";

export { ForbiddenError };

export type CurrentUser = { id: string; name: string; email: string; role: Role };

/** Validated server-side session + role, or null. The role is always read from the database. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email } = session.user;
  return { id, name, email, role: await getUserRole(id) };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Page/layout guard: redirects. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Guard for actions, route handlers and private data reads: throws instead of redirecting. */
export async function assertAdmin(): Promise<CurrentUser> {
  return assertAdminUser(await getCurrentUser());
}
