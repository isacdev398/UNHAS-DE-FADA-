import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AppointmentRow } from "@/components/admin/appointment-row";
import { List, PageHeader, Section, Stat } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/button";
import {
  IconBan,
  IconCalendar,
  IconChart,
  IconCheckCircle,
  IconChevronRight,
  IconLock,
  IconPlus,
  IconSparkle,
  IconUsers,
  IconWallet,
  IconWhatsApp,
} from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/misc";
import { getAdmin } from "@/lib/auth";
import { BLOCK_KIND_LABEL, getAdminSettings, listAppointments, listBlocks, listPendingPayments, listServices, listToClose, loadFinance, type AdminAppointment } from "@/lib/data/admin";
import { periodRange, percentChange, summarize } from "@/lib/finance";
import { formatBRL, formatBRLShort, whatsappUrl } from "@/lib/format";
import { addDays, formatDateTime, formatLocalDateLong, formatLocalDateShort, formatMonthYear, formatTime, todayIn, utcToZoned, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Início" };

/** Cores das fatias da barra de formas de pagamento (ordem de maior valor) */
const METHOD_COLORS = ["bg-rose-deep", "bg-petal", "bg-champagne", "bg-antique"];

export default async function AdminHome() {
  await connection();
  const now = new Date();
  const [admin, settings] = await Promise.all([getAdmin(), getAdminSettings()]);
  const tz = settings.tz;
  const today = todayIn(tz, now);
  const dayStart = zonedToUtc(today, 0, tz);
  const dayEnd = zonedToUtc(addDays(today, 1), 0, tz);
  const month = periodRange("mes", today);

  const [todayAppts, upcoming, pending, toClose, blocks, monthData, prevMonthData, { services }] = await Promise.all([
    listAppointments(dayStart, dayEnd),
    listAppointments(dayEnd, zonedToUtc(addDays(today, 8), 0, tz)),
    listPendingPayments(),
    listToClose(now),
    listBlocks(dayStart, dayEnd),
    loadFinance(zonedToUtc(month.from, 0, tz), zonedToUtc(month.to, 0, tz), month.from, month.to),
    loadFinance(zonedToUtc(month.prevFrom, 0, tz), zonedToUtc(month.prevTo, 0, tz), month.prevFrom, month.prevTo),
    listServices(),
  ]);

  const expected = todayAppts.reduce((s, a) => s + a.totalCents, 0);
  const received = todayAppts.reduce((s, a) => s + a.paidCents, 0);
  const done = todayAppts.filter((a) => a.status === "completed").length;
  const next = todayAppts.find((a) => a.status === "confirmed" && a.endsAt > now);
  const minutesToNext = next ? Math.round((next.startsAt.getTime() - now.getTime()) / 60_000) : null;
  const pendingTotal = pending.reduce((s, a) => s + a.totalCents - a.paidCents, 0);
  const hour = utcToZoned(now, tz).minutes / 60;
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const fin = summarize(monthData.appointments, monthData.payments, monthData.expenses);
  const prevFin = summarize(prevMonthData.appointments, prevMonthData.payments, prevMonthData.expenses);
  const change = percentChange(fin.receivedCents, prevFin.receivedCents);
  const activeServices = services.filter((s) => s.active).length;

  // Linha do tempo de hoje: atendimentos e bloqueios em ordem
  const timeline: ({ kind: "appt"; at: Date; appt: AdminAppointment } | { kind: "block"; at: Date; label: string; until: Date })[] = [
    ...todayAppts.map((a) => ({ kind: "appt" as const, at: a.startsAt, appt: a })),
    ...blocks.map((b) => ({ kind: "block" as const, at: b.startsAt < dayStart ? dayStart : b.startsAt, until: b.endsAt, label: b.reason || BLOCK_KIND_LABEL[b.kind] })),
  ].sort((x, y) => x.at.getTime() - y.at.getTime());

  return (
    <>
      <PageHeader
        eyebrow={formatLocalDateLong(today)}
        title={`${greeting}${admin ? `, ${admin.name.split(" ")[0]}` : ""}`}
        actions={
          <LinkButton href="/admin/agenda/novo" size="md" className="rounded-full px-4">
            <IconPlus size={18} /> Novo horário
          </LinkButton>
        }
      />

      {/* Indicadores de hoje */}
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Atendimentos"
          icon={<IconCalendar size={18} />}
          value={
            <>
              {todayAppts.length} <span className="font-sans text-sm font-normal text-cocoa-soft">hoje</span>
            </>
          }
          progress={todayAppts.length ? done / todayAppts.length : 0}
          hint={`${done} de ${todayAppts.length} finalizado(s)`}
        />
        <Stat
          label="Previsto hoje"
          icon={<IconWallet size={18} />}
          tone="brand"
          value={formatBRLShort(expected)}
          progress={expected ? received / expected : 0}
          hint={
            <span className="flex justify-between gap-2">
              <span className="font-semibold text-sage">{formatBRLShort(received)} rec.</span>
              <span>{formatBRLShort(Math.max(0, expected - received))} pend.</span>
            </span>
          }
        />
      </div>
      {pending.length > 0 && (
        <Link href="/admin/financeiro#pendentes" className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber">
          <span>
            <strong>{formatBRL(pendingTotal)}</strong> a receber de {pending.length} atendimento(s)
          </span>
          <IconChevronRight size={18} />
        </Link>
      )}

      {toClose.length > 0 && (
        <Section title="Para finalizar" icon={<IconCheckCircle size={20} />} action={<span className="label-caps rounded-full bg-surface-high px-2 py-0.5 text-cocoa-soft">Já passaram</span>}>
          <p className="mb-2 text-sm text-cocoa-soft">Marque como realizado e registre o pagamento.</p>
          <List>
            {toClose.slice(0, 5).map((a) => (
              <AppointmentRow key={a.id} appt={a} tz={tz} showDate={formatLocalDateShort(utcToZoned(a.startsAt, tz).date)} />
            ))}
          </List>
        </Section>
      )}

      {/* Cronograma de hoje */}
      <Section
        title="Cronograma de hoje"
        icon={<IconCalendar size={20} />}
        action={
          minutesToNext !== null && minutesToNext > 0 ? (
            <span className="label-caps rounded-full bg-surface-high px-2.5 py-1 text-cocoa-soft">
              Próximo em {minutesToNext >= 60 ? `${Math.floor(minutesToNext / 60)}h${String(minutesToNext % 60).padStart(2, "0")}` : `${minutesToNext} min`}
            </span>
          ) : (
            <Link href="/admin/agenda" className="text-[13px] font-semibold text-rose-deep">
              Ver agenda
            </Link>
          )
        }
      >
        {timeline.length === 0 ? (
          <EmptyState title="Nenhum atendimento hoje" action={<LinkButton href="/admin/agenda/novo" size="sm"><IconPlus size={16} /> Novo agendamento</LinkButton>} />
        ) : (
          <ul className="space-y-2">
            {timeline.map((item) =>
              item.kind === "block" ? (
                <li key={`b${item.at.getTime()}`} className="flex items-center gap-3 rounded-2xl bg-nude-soft px-4 py-3 text-sm">
                  <span className="font-semibold tabular text-cocoa-soft">{formatTime(item.at, tz)}</span>
                  <span className="size-1.5 rounded-full bg-antique" aria-hidden="true" />
                  <span className="flex-1 font-semibold text-cocoa">{item.label}</span>
                  <span className="text-xs text-cocoa-soft tabular">até {formatTime(item.until, tz)}</span>
                </li>
              ) : (
                <TimelineCard key={item.appt.id} appt={item.appt} tz={tz} highlight={item.appt.id === next?.id} />
              ),
            )}
          </ul>
        )}
      </Section>

      {/* Finanças do mês */}
      <Section
        title={`Finanças de ${formatMonthYear(today).split(" ")[0]}`}
        icon={<IconWallet size={20} />}
        action={
          <Link href="/admin/financeiro" className="flex items-center gap-0.5 text-[13px] font-semibold text-rose-deep">
            Detalhes <IconChevronRight size={16} />
          </Link>
        }
      >
        <div className="rounded-2xl bg-shell p-4 shadow-soft">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label-caps text-cocoa-soft">Recebido</p>
              <p className="font-display text-xl font-semibold text-cocoa tabular">{formatBRL(fin.receivedCents)}</p>
              {change !== null && (
                <p className={`text-xs font-semibold ${change >= 0 ? "text-sage" : "text-danger"}`}>
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs mês anterior
                </p>
              )}
            </div>
            <div>
              <p className="label-caps text-cocoa-soft">Despesas</p>
              <p className="font-display text-xl font-semibold text-cocoa tabular">{formatBRL(fin.expensesCents)}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-nude-soft p-3">
            <div>
              <p className="label-caps text-rose-deep">Resultado</p>
              <p className={`font-display text-2xl font-bold tabular ${fin.resultCents >= 0 ? "text-rose-deep" : "text-danger"}`}>{formatBRL(fin.resultCents)}</p>
            </div>
            <div className="text-right">
              <p className="label-caps text-cocoa-soft">Ticket médio</p>
              <p className="font-semibold text-cocoa tabular">{formatBRL(fin.averageTicketCents)}</p>
            </div>
          </div>
          {fin.byMethod.length > 0 && (
            <div className="mt-4">
              <p className="flex justify-between text-xs text-cocoa-soft">
                <span>Formas de pagamento</span>
                <span>{monthData.payments.filter((p) => !p.voided).length} recebimento(s)</span>
              </p>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-high" aria-hidden="true">
                {fin.byMethod.map((m, i) => (
                  <div key={m.name} className={METHOD_COLORS[i % METHOD_COLORS.length]} style={{ width: `${(m.cents / fin.receivedCents) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cocoa-soft">
                {fin.byMethod.map((m, i) => (
                  <li key={m.name} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${METHOD_COLORS[i % METHOD_COLORS.length]}`} aria-hidden="true" />
                    {m.name} {Math.round((m.cents / fin.receivedCents) * 100)}%
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {/* Ações rápidas */}
      <Section title="Ações rápidas">
        <div className="grid grid-cols-2 gap-2">
          <QuickAction href="/admin/agenda/bloqueios" icon={<IconBan size={20} />} title="Bloquear horário" hint="Folga, curso ou pausa" />
          <QuickAction href="/admin/servicos" icon={<IconSparkle size={20} />} title="Serviços e preços" hint={`${activeServices} serviço(s) ativo(s)`} />
          <QuickAction href="/admin/clientes" icon={<IconUsers size={20} />} title="Clientes" hint="Histórico e observações" />
          <QuickAction href="/admin/financeiro" icon={<IconChart size={20} />} title="Relatórios" hint="Recebido, despesas e pendências" />
        </div>
      </Section>

      <Section title="Próximos 7 dias" icon={<IconCalendar size={20} />}>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl bg-shell px-4 py-5 text-sm text-cocoa-soft shadow-soft">Nenhum agendamento ainda.</p>
        ) : (
          <List>
            {upcoming.map((a) => (
              <AppointmentRow key={a.id} appt={a} tz={tz} showDate={formatLocalDateShort(utcToZoned(a.startsAt, tz).date)} />
            ))}
          </List>
        )}
      </Section>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-cocoa-soft">
        <IconLock size={14} /> Dados protegidos · só você tem acesso
      </p>
    </>
  );
}

function QuickAction({ href, icon, title, hint }: { href: string; icon: ReactNode; title: string; hint: string }) {
  return (
    <Link href={href} className="flex flex-col gap-3 rounded-2xl bg-shell p-4 shadow-soft transition-shadow hover:shadow-lift">
      <span className="flex size-10 items-center justify-center rounded-xl bg-nude-soft text-rose-deep">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-cocoa">{title}</span>
        <span className="block text-xs text-cocoa-soft">{hint}</span>
      </span>
    </Link>
  );
}

/** Cartão de um atendimento na linha do tempo do dia */
function TimelineCard({ appt, tz, highlight }: { appt: AdminAppointment; tz: string; highlight: boolean }) {
  const due = appt.totalCents - appt.paidCents;
  const paid = appt.paidCents >= appt.totalCents && appt.totalCents > 0;
  const finished = appt.status === "completed" || appt.status === "no_show";
  const pill = paid
    ? { text: `Pago · ${formatBRLShort(appt.totalCents)}`, cls: "bg-sage-soft text-sage" }
    : appt.paidCents > 0
      ? { text: `Falta · ${formatBRLShort(due)}`, cls: "bg-amber-soft text-amber" }
      : { text: `A pagar · ${formatBRLShort(appt.totalCents)}`, cls: "bg-petal-soft text-rose-ink" };
  const reminder = `Oi, ${appt.client.name.split(" ")[0]}! Passando para lembrar do seu horário no Unhas de Fada: ${formatDateTime(appt.startsAt, tz)} (${appt.items.map((i) => i.name).join(" + ")}). Te espero!`;

  return (
    <li className={`relative overflow-hidden rounded-2xl bg-shell p-4 shadow-soft ${highlight ? "ring-1 ring-rose-deep/20" : ""}`}>
      {highlight && <span className="absolute inset-y-0 left-0 w-1 bg-rose-deep" aria-hidden="true" />}
      <Link href={`/admin/agenda/${appt.id}`} className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-3">
          <span className={`pt-0.5 text-[15px] font-semibold tabular ${finished ? "text-cocoa-soft" : "text-cocoa"}`}>{formatTime(appt.startsAt, tz)}</span>
          <span className="min-w-0">
            <span className={`block truncate text-[15px] font-semibold ${finished ? "text-cocoa-soft line-through decoration-1" : "text-cocoa"}`}>{appt.client.name}</span>
            <span className="block truncate text-[13px] text-cocoa-soft">{appt.items.map((i) => i.name).join(" + ")}</span>
          </span>
        </span>
        <span className={`label-caps shrink-0 rounded-full px-2.5 py-1 !text-[10px] ${pill.cls}`}>{pill.text}</span>
      </Link>
      <div className="mt-3 flex items-center gap-2">
        {appt.status === "completed" ? (
          <span className="flex items-center gap-1 text-[13px] font-semibold text-sage">
            <IconCheckCircle size={16} /> Concluído
          </span>
        ) : appt.status === "no_show" ? (
          <span className="text-[13px] font-semibold text-cocoa-soft">Não compareceu</span>
        ) : highlight ? (
          <LinkButton href={`/admin/agenda/${appt.id}`} size="sm" className="h-10 flex-1">
            <IconCheckCircle size={16} /> Concluir e receber
          </LinkButton>
        ) : null}
        {appt.status === "confirmed" && (
          <a
            href={whatsappUrl(appt.client.phone, reminder)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-nude-soft px-3 text-[13px] font-semibold text-rose-deep"
          >
            <IconWhatsApp size={15} /> Lembrete
          </a>
        )}
      </div>
    </li>
  );
}
