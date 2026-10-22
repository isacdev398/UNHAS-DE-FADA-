import type { Metadata } from "next";
import { ResetRequestForm } from "../auth-forms";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function ResetPage() {
  return (
    <>
      <h1 className="mb-2 font-display text-3xl text-rose-ink">Recuperar acesso</h1>
      <p className="mb-5 text-sm text-cocoa-soft">Enviaremos um link para você criar uma nova senha.</p>
      <ResetRequestForm />
    </>
  );
}
