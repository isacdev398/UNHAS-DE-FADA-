import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppointmentRow } from "@/components/admin/appointment-row";
import { List, PageHeader, Section, Stat } from "@/components/admin/ui";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { IconPlus, IconWhatsApp } from "@/components/ui/icons";
import { getAdminSettings, getClient } from "@/lib/data/admin";
import { formatBRL, formatPhone, whatsappUrl } from "@/lib/format";
import { formatLocalDateShort, utcToZoned } from "@/lib/time";
import { AnonymizeButton, ClientForm } from "../client-forms";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientPage({ params }: PageProps<"/admin/clientes/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [client, settings] = await Promise.all([getClient(id), getAdminSettings()]);
  if (!client) notFound();
  const tz = settings.tz;
  const now = new Date();
  const future = client.appointments.filter((a) => a.status === "confirmed" && a.startsAt > now).reverse();
  const past = client.appointments.filter((a) => !(a.status === "confirmed" && a.startsAt > now));
  const done = client.appointments.filter((a) => a.status === "completed");
  const services = new Map<string, number>();
  for (const a of done) for (const i of a.items) services.set(i.name, (services.get(i.name) ?? 0) + 1);
  const date = (d: Date) => formatLocalDateShort(utcToZoned(d, tz).date);

  if (client.anonymized_at) {
    return (
      <>
        <PageHeader title="Cliente removida" back={{ href: "/admin/clientes", label: "Clientes" }} />
        <p className="text-cocoa-soft">Os dados pessoais desta cliente foram removidos. O histórico financeiro foi mantido sem identificação.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={client.name} back={{ href: "/admin/clientes", label: "Clientes" }} description={formatPhone(client.phone)} />

      <div className="grid grid-cols-2 gap-2">
        <LinkButton href={`/admin/agenda/novo?cliente=${client.id}`}>
          <IconPlus size={18} /> Agendar
        </LinkButton>
        <a href={whatsappUrl(client.phone)} target="_blank" rel="noreferrer" className={buttonClass("whatsapp")}>
          <IconWhatsApp size={18} /> WhatsApp
        </a>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Atendimentos" value={done.length} />
        <Stat label="Total pago" value={formatBRL(client.totalPaidCents)} tone="good" />
        <Stat label="Agendados" value={future.length} />
      </div>
      {services.size > 0 && (
        <p className="mt-3 text-sm text-cocoa-soft">
          Serviços: {[...services].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${c})`).join(", ")}
        </p>
      )}

      {future.length > 0 && (
        <Section title="Próximos">
          <List>
            {future.map((a) => (
              <AppointmentRow key={a.id} appt={a} tz={tz} showDate={date(a.startsAt)} />
            ))}
          </List>
        </Section>
      )}

      <Section title="Histórico">
        {past.length === 0 ? (
          <p className="text-sm text-cocoa-soft">Sem atendimentos anteriores.</p>
        ) : (
          <List>
            {past.map((a) => (
              <AppointmentRow key={a.id} appt={a} tz={tz} showDate={date(a.startsAt)} />
            ))}
          </List>
        )}
      </Section>

      <Section title="Dados da cliente">
        <ClientForm client={{ id: client.id, name: client.name, phone: client.phone, notes: client.notes }} />
      </Section>

      <Section title="Privacidade">
        <p className="mb-3 text-sm text-cocoa-soft">
          Se a cliente pedir a exclusão dos dados (LGPD), use o botão abaixo. Agendamentos futuros precisam ser cancelados antes.
        </p>
        <AnonymizeButton id={client.id} />
      </Section>
    </>
  );
}
