import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { assertAdmin } from "@/lib/session";
import { getSettings } from "@/services/catalog";
import { loadRules } from "@/services/reservations";

export const metadata: Metadata = { title: "Настройки" };

export default async function SettingsPage() {
  await assertAdmin();
  const [settings, rules] = await Promise.all([getSettings(), loadRules()]);
  return <SettingsForm settings={settings} rules={rules} />;
}
