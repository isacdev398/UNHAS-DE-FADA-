import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/admin/ui";
import { getAdminSettings } from "@/lib/data/admin";
import { isWhatsAppProviderConfigured } from "@/lib/notifications";
import { WhatsAppToggle } from "./whatsapp-toggle";

export const metadata: Metadata = { title: "WhatsApp automático" };

export default async function WhatsAppPage() {
  await connection();
  const settings = await getAdminSettings();
  const configured = isWhatsAppProviderConfigured();
  return (
    <>
      <PageHeader title="WhatsApp automático" back={{ href: "/admin/configuracoes", label: "Configurações" }} />
      <div className="space-y-4 rounded-2xl bg-shell p-4 text-[15px] ring-1 ring-nude">
        <p>Quando ativado, o sistema envia sozinho:</p>
        <ul className="list-disc space-y-1 pl-5 text-cocoa-soft">
          <li>confirmação ao agendar;</li>
          <li>lembrete 24 horas antes;</li>
          <li>aviso de cancelamento;</li>
          <li>aviso de reagendamento.</li>
        </ul>
        {!configured ? (
          <p className="rounded-xl bg-amber-soft p-3 text-sm text-amber">
            Ainda não há um provedor de WhatsApp contratado e configurado, então as mensagens automáticas ficam desligadas. Enquanto isso, use os
            botões “Enviar confirmação” e “Enviar lembrete” em cada agendamento — eles abrem o seu WhatsApp com a mensagem pronta, sem custo.
          </p>
        ) : null}
        <WhatsAppToggle enabled={settings.whatsappNotificationsEnabled} configured={configured} />
      </div>
    </>
  );
}
