import type { Metadata } from "next";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Entrar no painel" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-5 font-display text-3xl text-rose-ink">Área da profissional</h1>
      <LoginForm />
    </>
  );
}
