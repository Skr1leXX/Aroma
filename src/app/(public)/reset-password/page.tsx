import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/public/auth-card";
import { ResetPasswordForm } from "@/components/public/auth-forms";

export const metadata: Metadata = { title: "Новый пароль" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <AuthCard title="Новый пароль">
      {token && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm">
          Ссылка недействительна или устарела. <Link href="/forgot-password" className="underline">Запросить новую</Link>
        </p>
      )}
    </AuthCard>
  );
}
