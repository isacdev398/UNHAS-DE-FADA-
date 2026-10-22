import type { Metadata } from "next";
import Link from "next/link";
import { NewPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Nova senha" };

export default function NewPasswordPage() {
  return (
    <>
      <h1 className="mb-5 font-display text-3xl text-rose-ink">Criar nova senha</h1>
      <NewPasswordForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/admin/configuracoes" className="text-rose-deep underline underline-offset-4">
          Voltar para as configurações
        </Link>
      </p>
    </>
  );
}
