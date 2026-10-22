import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, STATUS_LABEL } from "@/components/admin/ui";
import { Badge, Card } from "@/components/ui/misc";
import { getAdminSettings, getAppointment, listAppointmentPayments, listPaymentMethods } from "@/lib/data/admin";
import { siteUrl } from "@/lib/env";
import { formatBRL, formatDuration, formatPhone } from "@/lib/format";
import { formatDateTime, formatTime, utcToZoned } from "@/lib/time";
import { AppointmentActions } from "./appointment-actions";

export const metadata: Metadata = { title: "Agendamento" };

export default async function AppointmentPage({ params, searchParams }: PageProps<"/admin/agenda/[id]">) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [appt, payments, methods, settings] = await Promise.all([getAppointment(id), listAppointmentPayments(id), listPaymentMethods(), getAdminSettings()]);
  if (!appt) notFound();
  const tz = settings.tz;
  const status = STATUS_LABEL[appt.status];
  const due = Math.max(0, appt.totalCents - appt.paidCents);
  const newLink = typeof sp.link === "string" && /^[A-Za-z0-9_-]{43}$/.test(sp.link) ? `${siteUrl()}/meu-agendamento/${sp.link}` : null;
  const local = utcToZoned(appt.startsAt, tz);

  return (
    <>
      <PageHeader title={appt.client.name} back={{ href: `/admin/agenda?data=${local.date}`, label: "Agenda" }} />

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-medium first-letter:uppercase">{formatDateTime(appt.startsAt, tz)}</p>
            <p className="text-sm text-cocoa-soft">
              até {formatTime(appt.endsAt, tz)} · {formatDuration(Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60000))} ·{" "}
              {appt.source === "online" ? "agendado pelo site" : "agendado no painel"}
            </p>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <ul className="mt-4 space-y-1 border-t border-nude pt-3 text-[15px]">
          {appt.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>{i.name}</span>
              <span className="tabular">
                {i.priceCents < i.listPriceCents && <s className="mr-2 text-sm text-cocoa-soft">{formatBRL(i.listPriceCents)}</s>}
                {formatBRL(i.priceCents)}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-nude pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular">{formatBRL(appt.totalCents)}</span>
          </li>
          <li className="flex justify-between gap-3 text-sm">
            <span className="text-cocoa-soft">Recebido</span>
            <span className="tabular text-sage">{formatBRL(appt.paidCents)}</span>
          </li>
          {due > 0 && appt.status !== "cancelled" && (
            <li className="flex justify-between gap-3 text-sm">
              <span className="text-cocoa-soft">Falta receber</span>
              <span className="font-medium tabular text-amber">{formatBRL(due)}</span>
            </li>
          )}
        </ul>
        <p className="mt-3 text-sm">
          <Link href={`/admin/clientes/${appt.client.id}`} className="font-medium text-rose-deep underline underline-offset-4">
            {formatPhone(appt.client.phone)} · ver ficha da cliente
          </Link>
        </p>
        {appt.cancelReason && <p className="mt-2 text-sm text-danger">Motivo do cancelamento: {appt.cancelReason}</p>}
      </Card>

      <AppointmentActions
        appt={{
          id: appt.id,
          status: appt.status,
          dueCents: due,
          notes: appt.notes,
          clientName: appt.client.name,
          clientPhone: appt.client.phone,
          whenLabel: formatDateTime(appt.startsAt, tz),
          services: appt.items.map((i) => i.name).join(" + "),
          date: local.date,
        }}
        payments={payments.map((p) => ({ ...p, paidAt: p.paidAt.toISOString(), voidedAt: p.voidedAt?.toISOString() ?? null }))}
        methods={methods}
        newLink={newLink}
        tz={tz}
      />
    </>
  );
}
