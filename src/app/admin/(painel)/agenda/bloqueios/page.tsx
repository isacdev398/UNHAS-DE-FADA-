import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader, Section } from "@/components/admin/ui";
import { BLOCK_KIND_LABEL, getAdminSettings, listBlocks } from "@/lib/data/admin";
import { addDays, formatTime, todayIn, utcToZoned } from "@/lib/time";
import { BlockForm, DeleteBlockButton } from "./block-form";

export const metadata: Metadata = { title: "Folgas e bloqueios" };

export default async function BlocksPage() {
  await connection();
  const settings = await getAdminSettings();
  const tz = settings.tz;
  const blocks = await listBlocks(new Date());
  const fmt = (d: Date) => {
    const l = utcToZoned(d, tz);
    return `${l.date.slice(8)}/${l.date.slice(5, 7)} ${formatTime(d, tz)}`;
  };
  // Dias inteiros (00:00 → 00:00) aparecem só com as datas.
  const period = (start: Date, end: Date) => {
    const s = utcToZoned(start, tz);
    const e = utcToZoned(end, tz);
    if (s.minutes !== 0 || e.minutes !== 0) return `${fmt(start)} → ${fmt(end)}`;
    const last = addDays(e.date, -1);
    const short = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
    return last === s.date ? `${short(s.date)} · dia inteiro` : `${short(s.date)} a ${short(last)} · dias inteiros`;
  };

  return (
    <>
      <PageHeader
        title="Folgas e bloqueios"
        back={{ href: "/admin/agenda", label: "Agenda" }}
        description="Horários bloqueados não aparecem para agendamento. Agendamentos já marcados não são cancelados."
      />
      <BlockForm today={todayIn(tz)} />
      <Section title="Próximos bloqueios">
        {blocks.length === 0 ? (
          <p className="text-sm text-cocoa-soft">Nenhum bloqueio futuro.</p>
        ) : (
          <ul className="divide-y divide-nude/70 rounded-2xl bg-shell shadow-soft">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {BLOCK_KIND_LABEL[b.kind]}
                    {b.reason && <span className="font-normal text-cocoa-soft"> · {b.reason}</span>}
                  </p>
                  <p className="text-sm text-cocoa-soft tabular">
                    {period(b.startsAt, b.endsAt)}
                  </p>
                </div>
                <DeleteBlockButton id={b.id} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
