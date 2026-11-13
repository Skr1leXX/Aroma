"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Field, FormStatus } from "@/components/public/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import type { ActionState } from "@/types";

// Client-side zod is UX only. Better Auth re-validates everything on the server,
// and the role is never part of any request from here.
const email = z.string().trim().email("Введите корректный email");
const password = z.string().min(8, "Не менее 8 символов").max(128);

const schemas = {
  login: z.object({ email, password: z.string().min(1, "Введите пароль") }),
  register: z
    .object({ name: z.string().trim().min(2, "Укажите имя"), email, password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Пароли не совпадают" }),
  forgot: z.object({ email }),
  reset: z.object({ password }),
};

function AuthForm<S extends keyof typeof schemas>({
  schema, submit, label, children,
}: {
  schema: S;
  submit: (data: z.infer<(typeof schemas)[S]>) => Promise<ActionState>;
  label: string;
  children: (errors: Record<string, string[] | undefined>) => ReactNode;
}) {
  const [state, setState] = useState<ActionState>({ ok: false });
  const [pending, setPending] = useState(false);

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const parsed = schemas[schema].safeParse(Object.fromEntries(new FormData(ev.currentTarget)));
    if (!parsed.success) {
      return setState({ ok: false, message: "Проверьте поля формы", errors: z.flattenError(parsed.error as z.ZodError).fieldErrors });
    }
    setPending(true);
    try {
      setState(await submit(parsed.data as z.infer<(typeof schemas)[S]>));
    } catch {
      setState({ ok: false, message: "Что-то пошло не так. Попробуйте ещё раз." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {children(state.errors ?? {})}
      <FormStatus state={state} />
      <Button type="submit" size="lg" disabled={pending} className="w-full bg-terracotta text-white hover:bg-terracotta/90">
        {pending && <Loader2 className="animate-spin" />} {label}
      </Button>
    </form>
  );
}

export function LoginForm() {
  const router = useRouter();
  return (
    <>
      <AuthForm
        schema="login"
        label="Войти"
        submit={async (d) => {
          const { error } = await authClient.signIn.email(d);
          if (error) return { ok: false, message: "Неверный email или пароль" };
          router.push("/account");
          router.refresh();
          return { ok: true };
        }}
      >
        {(e) => (
          <>
            <Field name="email" label="Email" errors={e.email}><Input id="email" name="email" type="email" autoComplete="email" /></Field>
            <Field name="password" label="Пароль" errors={e.password}><Input id="password" name="password" type="password" autoComplete="current-password" /></Field>
          </>
        )}
      </AuthForm>
      <p className="mt-6 flex justify-between text-sm text-muted-foreground">
        <Link href="/forgot-password" className="hover:text-terracotta">Забыли пароль?</Link>
        <Link href="/register" className="hover:text-terracotta">Регистрация</Link>
      </p>
    </>
  );
}

export function RegisterForm() {
  const router = useRouter();
  return (
    <>
      <AuthForm
        schema="register"
        label="Создать аккаунт"
        submit={async ({ name, email, password }) => {
          const { error } = await authClient.signUp.email({ name, email, password });
          if (error) return { ok: false, message: error.message || "Не удалось зарегистрироваться" };
          router.push("/account");
          router.refresh();
          return { ok: true };
        }}
      >
        {(e) => (
          <>
            <Field name="name" label="Имя" errors={e.name}><Input id="name" name="name" autoComplete="name" /></Field>
            <Field name="email" label="Email" errors={e.email}><Input id="email" name="email" type="email" autoComplete="email" /></Field>
            <Field name="password" label="Пароль" errors={e.password}><Input id="password" name="password" type="password" autoComplete="new-password" /></Field>
            <Field name="confirm" label="Повторите пароль" errors={e.confirm}><Input id="confirm" name="confirm" type="password" autoComplete="new-password" /></Field>
          </>
        )}
      </AuthForm>
      <p className="mt-6 text-sm text-muted-foreground">
        Уже есть аккаунт? <Link href="/login" className="text-foreground underline">Войти</Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm() {
  return (
    <AuthForm
      schema="forgot"
      label="Отправить ссылку"
      submit={async ({ email }) => {
        await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
        // Same answer whether or not the account exists (no user enumeration).
        return { ok: true, message: "Если такой аккаунт существует, мы отправили ссылку для восстановления." };
      }}
    >
      {(e) => <Field name="email" label="Email" errors={e.email}><Input id="email" name="email" type="email" autoComplete="email" /></Field>}
    </AuthForm>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  return (
    <AuthForm
      schema="reset"
      label="Сохранить пароль"
      submit={async ({ password }) => {
        const { error } = await authClient.resetPassword({ newPassword: password, token });
        if (error) return { ok: false, message: "Ссылка недействительна или устарела. Запросите новую." };
        router.push("/login");
        return { ok: true, message: "Пароль изменён. Перенаправляем на вход…" };
      }}
    >
      {(e) => <Field name="password" label="Новый пароль" errors={e.password}><Input id="password" name="password" type="password" autoComplete="new-password" /></Field>}
    </AuthForm>
  );
}
