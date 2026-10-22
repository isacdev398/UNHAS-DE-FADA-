"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset, signIn, updatePassword } from "./actions";

export function LoginForm() {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" spellCheck={false} required />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage result={state} />
      <SubmitButton size="lg" className="w-full">
        Entrar
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/admin/recuperar" className="text-rose-deep underline underline-offset-4">
          Esqueci a senha
        </Link>
      </p>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="E-mail de acesso" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" spellCheck={false} required />
      </Field>
      <FormMessage result={state} />
      <SubmitButton size="lg" className="w-full">
        Enviar link
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/admin/entrar" className="text-rose-deep underline underline-offset-4">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Nova senha" htmlFor="password" hint="Pelo menos 10 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Repita a nova senha" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <FormMessage result={state} />
      <SubmitButton size="lg" className="w-full">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
