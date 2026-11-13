import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/public/auth-card";
import { RegisterForm } from "@/components/public/auth-forms";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Регистрация" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/account");
  return (
    <AuthCard title="Регистрация" description="Аккаунт нужен только для истории бронирований — заказать стол можно и без него.">
      <RegisterForm />
    </AuthCard>
  );
}
