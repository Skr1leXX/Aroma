import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/public/auth-card";
import { LoginForm } from "@/components/public/auth-forms";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/account");
  return (
    <AuthCard title="Вход" description="Войдите, чтобы видеть свои бронирования.">
      <LoginForm />
    </AuthCard>
  );
}
