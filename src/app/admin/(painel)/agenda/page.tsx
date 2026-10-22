import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AppointmentRow } from "@/components/admin/appointment-row";
import { List, PageHeader } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/button";
import { IconChevronLeft, IconChevronRight, IconLock, IconPlus } from "@/components/ui/icons";
import { BLOCK_KIND_LABEL, getAdminSettings, listAppointments, listBlocks } from "@/lib/data/admin";
import {
  addDays,
  daysInMonth,
  formatLocalDateLong,
  formatLocalDateShort,
  formatMonthYear,
  formatTime,
  formatWeekdayShort,
  startOfMonth,
  startOfWeek,
  todayIn,
  utcToZoned,
  weekdayOf,
  zonedToUtc,
} from "@/lib/time";

export const metadata: Metadata = { title: "Agenda" };

type View = "dia" | "semana" | "mes";

export default async function AgendaPage({ searchParams }: PageProps<"/admin/agenda">) {
  await connection();
  const sp = await searchParams;
  const settings = await getAdminSettings();
  const tz = settings.tz;
  const today = todayIn(tz);
  const view: View = sp.view === "semana" || sp.view === "mes" ? sp.view : "dia";
  const date = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : today;

  const range =
    view === "dia"
      ? { from: date, to: addDays(date, 1), prev: addDays(date, -1), next: addDays(date, 1) }
      : view === "semana"
        ? { from: startOfWeek(date), to: addDays(startOfWeek(date), 7), prev: addDays(date, -7), next: addDays(date, 7) }
        : { from: startOfMonth(date), to: addDays(startOfMonth(date), daysInMonth(date)), prev: addDays(startOfMonth(date), -1), next: addDays(startOfMonth(date), daysInMonth(date)) };

  const fromUtc = zonedToUtc(range.from, 0, tz);
  const toUtc = zonedToUtc(range.to, 0, tz);
  const [appts, blocks] = await Promise.all([listAppointments(fromUtc, toUtc), listBlocks(fromUtc, toUtc)]);

  const byDate = new Map<string, typeof appts>();
  for (const a of appts) {
    const d = utcToZoned(a.startsAt, tz).date;
    byDate.set(d, [...(byDate.get(d) ?? []), a]);
  }

  const title =
    view === "dia" ? formatLocalDateLong(date) : view === "semana" ? `${formatLocalDateShort(range.from)} a ${formatLocalDateShort(addDays(range.to, -1))}` : formatMonthYear(date);
  const href = (v: View, d: string) => `/admin/agenda?view=${v}&data=${d}`;

  return (
    <>
      <PageHeader
        title="Agenda"
        actions={
          <LinkButton href={`/admin/agenda/novo?data=${date}`} size="sm" aria-label="Novo agendamento">
            <IconPlus size={18} /> <span className="hidden sm:inline">Novo</span>
          </LinkButton>
        }
      />

      <div className="flex items-center gap-1 rounded-pill bg-shell p-1 ring-1 ring-nude" role="tablist" aria-label="Visualização">
        {(["dia", "semana", "mes"] as View[]).map((v) => (
          <Link
            key={v}
            href={href(v, date)}
            role="tab"
            aria-selected={view === v}
            className={`flex min-h-10 flex-1 items-center justify-center rounded-pill text-sm font-medium ${view === v ? "bg-rose-deep text-shell" : "text-cocoa-soft"}`}
          >
            {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Link href={href(view, range.prev)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-nude-soft" aria-label="Anterior">
          <IconChevronLeft />
        </Link>
        <div className="text-center">
          <p className="font-medium first-letter:uppercase">{title}</p>
          {(date !== today || view !== "dia") && (
            <Link href={href("dia", today)} className="text-sm text-rose-deep underline underline-offset-4">
              Hoje
            </Link>
          )}
        </div>
        <Link href={href(view, range.next)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-nude-soft" aria-label="Próximo">
          <IconChevronRight />
        </Link>
      </div>

      {view === "dia" && (
        <div className="mt-4 space-y-3">
          {blocks.map((b) => (
            <p key={b.id} className="flex items-center gap-2 rounded-2xl bg-nude-soft px-4 py-3 text-sm text-rose-ink">
              <IconLock size={18} />
              <span className="font-medium">{BLOCK_KIND_LABEL[b.kind]}</span>
              <span className="tabular">
                {utcToZoned(b.startsAt, tz).date < date ? "o dia todo" : formatTime(b.startsAt, tz)}
                {utcToZoned(b.endsAt, tz).date === date && ` – ${formatTime(b.endsAt, tz)}`}
              </span>
              {b.reason && <span className="truncate text-cocoa-soft">· {b.reason}</span>}
            </p>
          ))}
          {appts.length === 0 ? (
            <p className="rounded-2xl bg-shell px-4 py-8 text-center text-cocoa-soft shadow-soft">Nenhum atendimento neste dia.</p>
          ) : (
            <List>
              {appts.map((a) => (
                <AppointmentRow key={a.id} appt={a} tz={tz} />
              ))}
            </List>
          )}
        </div>
      )}

      {view === "semana" && (
        <div className="mt-4 space-y-4">
          {Array.from({ length: 7 }, (_, i) => addDays(range.from, i)).map((d) => {
            const list = byDate.get(d) ?? [];
            const dayBlocked = blocks.some((b) => b.startsAt <= zonedToUtc(d, 0, tz) && b.endsAt >= zonedToUtc(addDays(d, 1), 0, tz));
            return (
              <section key={d} aria-label={formatLocalDateLong(d)}>
                <Link href={href("dia", d)} className={`mb-1.5 flex items-baseline gap-2 text-sm ${d === today ? "font-semibold text-rose-deep" : "text-cocoa-soft"}`}>
                  <span className="capitalize">{formatWeekdayShort(d)}</span>
                  <span className="tabular">{formatLocalDateShort(d)}</span>
                  {dayBlocked && <span className="text-xs">· bloqueado</span>}
                  <span className="ml-auto text-xs">{list.length || ""}</span>
                </Link>
                {list.length > 0 ? (
                  <List>
                    {list.map((a) => (
                      <AppointmentRow key={a.id} appt={a} tz={tz} />
                    ))}
                  </List>
                ) : (
                  <div className="h-px bg-nude" />
                )}
              </section>
            );
          })}
        </div>
      )}

      {view === "mes" && (
        <div className="mt-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-cocoa-soft" aria-hidden="true">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: weekdayOf(range.from) }, (_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth(date) }, (_, i) => addDays(range.from, i)).map((d) => {
              const count = byDate.get(d)?.length ?? 0;
              return (
                <Link
                  key={d}
                  href={href("dia", d)}
                  aria-label={`${formatLocalDateLong(d)}: ${count} atendimento(s)`}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm ${d === today ? "ring-2 ring-rose-deep" : ""} ${count ? "bg-shell font-semibold text-rose-ink" : "text-cocoa-soft hover:bg-shell/60"}`}
                >
                  <span className="tabular">{Number(d.slice(8))}</span>
                  {count > 0 && <span className="mt-0.5 rounded-full bg-rose-deep px-1.5 text-[10px] leading-4 text-shell tabular">{count}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-2">
        <LinkButton href="/admin/agenda/bloqueios" variant="secondary">
          Folgas e bloqueios
        </LinkButton>
        <LinkButton href="/admin/agenda/horarios" variant="secondary">
          Horários e regras
        </LinkButton>
      </div>
    </>
  );
}
