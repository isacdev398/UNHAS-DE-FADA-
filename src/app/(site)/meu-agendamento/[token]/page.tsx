import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TrackEvent } from "@/components/site/analytics";
import { SiteHeader } from "@/components/site/header";
import { buttonClass } from "@/components/ui/button";
import { IconCalendar, IconCheck, IconWhatsApp } from "@/components/ui/icons";
import { Badge } from "@/components/ui/misc";
import { getSettings } from "@/lib/data/agenda";
import { findByToken } from "@/lib/data/manage";
import { getPublishedContent } from "@/lib/data/public";
import { isSupabaseConfigured } from "@/lib/env";
import { formatBRL, formatDuration, whatsappUrl } from "@/lib/format";
import { canClientCancel, canClientReschedule } from "@/lib/policy";
import { formatDateTime, formatTime } from "@/lib/time";
import { ManageActions } from "./manage-actions";

export const metadata: Metadata = {
  title: "Meu agendamento",
  robots: { index: false, follow: false },
};

export default function ManagePage({ params, searchParams }: PageProps<"/meu-agendamento/[token]">) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:px-6">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-3xl bg-shell/60" />}>
          <ManageContent params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

const STATUS = {
  confirmed: { label: "Confirmado", tone: "sage" },
  completed: { label: "Realizado", tone: "rose" },
  cancelled: { label: "Cancelado", tone: "danger" },
  no_show: { label: "Não compareceu", tone: "neutral" },
} as const;

async function ManageContent({
  params,
  searchParams,
}: Pick<PageProps<"/meu-agendamento/[token]">, "params" | "searchParams">) {
  await connection();
  const { token } = await params;
  const { novo } = await searchParams;
  if (!isSupabaseConfigured()) notFound();

  const appt = await findByToken(token);
  if (!appt) notFound();

  const [settings, content] = await Promise.all([getSettings(), getPublishedContent()]);
  const now = new Date();
  const isNew = novo === "1" && appt.status === "confirmed";
  const cancel = canClientCancel(settings, appt.startsAt, now);
  const reschedule = canClientReschedule(settings, appt.startsAt, now);
  const when = formatDateTime(appt.startsAt, settings.tz);
  const status = STATUS[appt.status];
  const waText = `Olá! Sou ${appt.clientFirstName}, tenho horário marcado para ${when} (${appt.items.map((i) => i.name).join(" + ")}).`;

  return (
    <div className="space-y-6">
      {isNew && <TrackEvent kind="booking_complete" />}
      {isNew ? (
        <div className="text-center motion-safe:animate-rise">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-sage text-white shadow-soft">
            <IconCheck size={32} strokeWidth={2.2} />
          </span>
          <h1 className="mt-4 font-display text-4xl font-medium text-rose-ink">Horário confirmado!</h1>
          <p className="mt-2 text-cocoa-soft">
            {appt.clientFirstName ? `${appt.clientFirstName}, te` : "Te"} esperamos com carinho. Guarde este link: por ele você
            consulta, reagenda ou cancela.
          </p>
        </div>
      ) : (
        <h1 className="font-display text-4xl font-medium text-rose-ink">Meu agendamento</h1>
      )}

      <section className="rounded-3xl bg-shell p-5 shadow-soft ring-1 ring-nude" aria-label="Detalhes do agendamento">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-start gap-2.5 text-lg font-medium">
            <IconCalendar className="mt-1 shrink-0 text-rose" />
            <span className="first-letter:uppercase">{when}</span>
          </p>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-1 pl-8 text-sm text-cocoa-soft">
          Até {formatTime(appt.endsAt, settings.tz)} · {formatDuration(Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60000))}
        </p>
        <ul className="mt-4 space-y-1 border-t border-nude pt-3 text-[15px]">
          {appt.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>{i.name}</span>
              <span className="tabular">{formatBRL(i.priceCents)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-nude pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular">{formatBRL(appt.totalCents)}</span>
          </li>
        </ul>
        {content.address && (
          <p className="mt-4 text-sm text-cocoa-soft">
            {content.address}
            {content.city && `, ${content.city}`}
          </p>
        )}
      </section>

      {appt.status === "confirmed" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <a href={`/meu-agendamento/${token}/calendario`} className={buttonClass("secondary", "md")}>
            <IconCalendar size={18} /> Salvar na agenda
          </a>
          <a href={whatsappUrl(content.whatsapp, waText)} className={buttonClass("whatsapp", "md")}>
            <IconWhatsApp size={18} /> Falar no WhatsApp
          </a>
        </div>
      )}

      {appt.status === "cancelled" && (
        <a href="/agendar" className={buttonClass("primary", "lg", "w-full")}>
          <IconCalendar size={20} /> Agendar novo horário
        </a>
      )}

      {appt.status === "confirmed" && (
        <ManageActions
          token={token}
          tz={settings.tz}
          whatsapp={content.whatsapp}
          cancel={cancel.allowed ? null : cancel.reason}
          reschedule={reschedule.allowed ? null : reschedule.reason}
        />
      )}
    </div>
  );
}
