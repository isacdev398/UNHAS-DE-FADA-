import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/admin/ui";
import { getAdminSettings, getClient, listServices } from "@/lib/data/admin";
import { todayIn } from "@/lib/time";
import { NewAppointmentForm } from "./new-appointment-form";

export const metadata: Metadata = { title: "Novo agendamento" };

export default async function NewAppointmentPage({ searchParams }: PageProps<"/admin/agenda/novo">) {
  await connection();
  const sp = await searchParams;
  const [settings, { services }] = await Promise.all([getAdminSettings(), listServices()]);
  const date = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : todayIn(settings.tz);
  const clientId = typeof sp.cliente === "string" && /^[0-9a-f-]{36}$/.test(sp.cliente) ? sp.cliente : undefined;
  const client = clientId ? await getClient(clientId) : null;

  return (
    <>
      <PageHeader title="Novo agendamento" back={{ href: "/admin/agenda", label: "Agenda" }} />
      <NewAppointmentForm
        services={services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, priceCents: s.priceCents, durationMinutes: s.durationMinutes }))}
        initialDate={date}
        initialClient={client && !client.anonymized_at ? { id: client.id, name: client.name, phone: client.phone } : null}
        tz={settings.tz}
      />
    </>
  );
}
