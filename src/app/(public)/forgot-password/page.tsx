import type { Metadata } from "next";
import { AuthCard } from "@/components/public/auth-card";
import { ForgotPasswordForm } from "@/components/public/auth-forms";

export const metadata: Metadata = { title: "Восстановление пароля" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Забыли пароль?" description="Укажите email — пришлём ссылку для создания нового пароля.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
