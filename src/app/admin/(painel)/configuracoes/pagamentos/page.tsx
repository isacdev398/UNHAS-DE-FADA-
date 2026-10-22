import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader, Section } from "@/components/admin/ui";
import { listPaymentMethods } from "@/lib/data/admin";
import { MethodForm, MethodToggle } from "./method-forms";

export const metadata: Metadata = { title: "Formas de pagamento" };

export default async function PaymentMethodsPage() {
  await connection();
  const methods = await listPaymentMethods(true);
  return (
    <>
      <PageHeader title="Formas de pagamento" back={{ href: "/admin/configuracoes", label: "Configurações" }} description="Formas desligadas não aparecem ao registrar pagamentos. O histórico é mantido." />
      <ul className="divide-y divide-nude/70 rounded-2xl bg-shell shadow-soft">
        {methods.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-1">
            <span className={m.active ? "font-medium" : "text-cocoa-soft"}>{m.name}</span>
            <MethodToggle id={m.id} active={m.active} name={m.name} />
          </li>
        ))}
      </ul>
      <Section title="Adicionar forma">
        <MethodForm />
      </Section>
    </>
  );
}
