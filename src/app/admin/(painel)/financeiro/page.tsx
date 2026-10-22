import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AppointmentRow } from "@/components/admin/appointment-row";
import { List, PageHeader, Section, Stat } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/button";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";
import { getAdminSettings, listPendingPayments, loadFinance } from "@/lib/data/admin";
import { percentChange, periodRange, summarize, type PeriodKind } from "@/lib/finance";
import { formatBRL } from "@/lib/format";
import { addDays, formatLocalDateLong, formatLocalDateShort, formatMonthYear, formatTime, todayIn, utcToZoned, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Financeiro" };

const PERIODS: { key: PeriodKind; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
];

function Change({ current, previous, label }: { current: number; previous: number; label: string }) {
  const pct = percentChange(current, previous);
  if (pct === null) return <>sem base de comparação</>;
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "=";
  return (
    <span className={pct > 0 ? "text-sage" : pct < 0 ? "text-danger" : ""}>
      <span aria-hidden="true">{arrow}</span> {Math.abs(pct)}% vs {label}
    </span>
  );
}

export default async function FinancePage({ searchParams }: PageProps<"/admin/financeiro">) {
  await connection();
  const sp = await searchParams;
  const settings = await getAdminSettings();
  const tz = settings.tz;
  const today = todayIn(tz);
  const kind: PeriodKind = PERIODS.some((p) => p.key === sp.periodo) ? (sp.periodo as PeriodKind) : "mes";
  const anchor = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : today;
  const r = periodRange(kind, anchor);

  const [cur, prev, pending] = await Promise.all([
    loadFinance(zonedToUtc(r.from, 0, tz), zonedToUtc(r.to, 0, tz), r.from, r.to),
    loadFinance(zonedToUtc(r.prevFrom, 0, tz), zonedToUtc(r.prevTo, 0, tz), r.prevFrom, r.prevTo),
    listPendingPayments(),
  ]);
  const s = summarize(cur.appointments, cur.payments, cur.expenses);
  const p = summarize(prev.appointments, prev.payments, prev.expenses);
  const pendingTotal = pending.reduce((sum, a) => sum + a.totalCents - a.paidCents, 0);

  const label =
    kind === "dia" ? formatLocalDateLong(r.from) : kind === "semana" ? `${formatLocalDateShort(r.from)} a ${formatLocalDateShort(addDays(r.to, -1))}` : kind === "mes" ? formatMonthYear(r.from) : r.from.slice(0, 4);
  const prevLabel = { dia: "dia anterior", semana: "semana anterior", mes: "mês anterior", ano: "ano anterior" }[kind];
  const href = (k: PeriodKind, d: string) => `/admin/financeiro?periodo=${k}&data=${d}`;

  return (
    <>
      <PageHeader title="Financeiro" actions={<LinkButton href="/admin/financeiro/despesas" size="sm" variant="secondary">Despesas</LinkButton>} />

      <div className="flex items-center gap-1 rounded-pill bg-shell p-1 ring-1 ring-nude" role="tablist" aria-label="Período">
        {PERIODS.map((x) => (
          <Link key={x.key} href={href(x.key, anchor)} role="tab" aria-selected={kind === x.key} className={`flex min-h-10 flex-1 items-center justify-center rounded-pill text-sm font-medium ${kind === x.key ? "bg-rose-deep text-shell" : "text-cocoa-soft"}`}>
            {x.label}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Link href={href(kind, addDays(r.from, -1))} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-nude-soft" aria-label="Período anterior">
          <IconChevronLeft />
        </Link>
        <p className="font-medium first-letter:uppercase">{label}</p>
        <Link href={href(kind, r.to)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-nude-soft" aria-label="Próximo período">
          <IconChevronRight />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Recebido" value={formatBRL(s.receivedCents)} tone="good" hint={<Change current={s.receivedCents} previous={p.receivedCents} label={prevLabel} />} />
        <Stat label="Previsto (agendado)" value={formatBRL(s.expectedCents)} hint={`${s.scheduledCount} atendimento(s)`} />
        <Stat label="Despesas" value={formatBRL(s.expensesCents)} hint={<Change current={s.expensesCents} previous={p.expensesCents} label={prevLabel} />} />
        <Stat label="Resultado" value={formatBRL(s.resultCents)} tone={s.resultCents >= 0 ? "good" : "warn"} hint="recebido − despesas" />
        <Stat label="Atendimentos realizados" value={s.completedCount} hint={<Change current={s.completedCount} previous={p.completedCount} label={prevLabel} />} />
        <Stat label="Ticket médio" value={formatBRL(s.averageTicketCents)} />
      </div>
      <p className="mt-2 text-xs text-cocoa-soft">Recebido conta só pagamentos registrados (sem estornos). Pendências não entram como recebido.</p>

      {s.byMethod.length > 0 && (
        <Section title="Por forma de pagamento">
          <ul className="space-y-2">
            {s.byMethod.map((m) => (
              <li key={m.name} className="rounded-2xl bg-shell px-4 py-3 shadow-soft">
                <div className="flex justify-between text-sm">
                  <span>{m.name}</span>
                  <span className="font-medium tabular">{formatBRL(m.cents)}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-nude-soft" aria-hidden="true">
                  <div className="h-full rounded-full bg-rose" style={{ width: `${Math.round((m.cents / s.receivedCents) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {s.topServices.length > 0 && (
        <Section title="Serviços mais vendidos">
          <ol className="divide-y divide-nude/70 rounded-2xl bg-shell shadow-soft">
            {s.topServices.map((x, i) => (
              <li key={x.serviceId} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-5 text-cocoa-soft tabular">{i + 1}.</span>
                <span className="flex-1 font-medium">{x.name}</span>
                <span className="text-cocoa-soft tabular">{x.count}×</span>
                <span className="w-24 text-right tabular">{formatBRL(x.cents)}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="A receber" action={<span className="text-sm font-medium tabular text-amber">{formatBRL(pendingTotal)}</span>}>
        <div id="pendentes" className="scroll-mt-20" />
        {pending.length === 0 ? (
          <p className="rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage">Nenhum pagamento pendente.</p>
        ) : (
          <List>
            {pending.map((a) => (
              <AppointmentRow key={a.id} appt={a} tz={tz} showDate={formatLocalDateShort(utcToZoned(a.startsAt, tz).date)} />
            ))}
          </List>
        )}
      </Section>

      <Section title="Pagamentos recebidos">
        {cur.payments.length === 0 ? (
          <p className="text-sm text-cocoa-soft">Nenhum pagamento no período.</p>
        ) : (
          <ul className="divide-y divide-nude/70 rounded-2xl bg-shell shadow-soft">
            {cur.payments.slice(0, 50).map((pay) => {
              const row = (
                <>
                  <span className="w-20 shrink-0 text-cocoa-soft tabular">
                    {formatLocalDateShort(utcToZoned(pay.paidAt, tz).date)} {formatTime(pay.paidAt, tz)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {pay.clientName || "—"} · {pay.methodName}
                  </span>
                  <span className={`tabular ${pay.voided ? "text-cocoa-soft line-through" : "font-medium"}`}>{formatBRL(pay.amountCents)}</span>
                </>
              );
              return (
                <li key={pay.id}>
                  {pay.appointmentId ? (
                    <Link href={`/admin/agenda/${pay.appointmentId}`} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm hover:bg-nude-soft/60">
                      {row}
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
