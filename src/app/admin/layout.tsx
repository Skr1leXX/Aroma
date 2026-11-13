import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: { default: "Админ-панель", template: "%s · Aroma Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

// Layouts do not re-run on client navigation, so every admin data read ALSO asserts the role
// (see services/catalog.ts) and every action calls assertAdmin().
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <AdminShell email={user.email}>{children}</AdminShell>;
}
