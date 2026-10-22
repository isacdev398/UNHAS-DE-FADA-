import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader, Section } from "@/components/admin/ui";
import { getAdminSettings, getScheduleConfig } from "@/lib/data/admin";
import { formatLocalDateLong } from "@/lib/time";
import { DeleteExceptionButton, ExceptionForm, RulesForm, WeeklyHoursEditor } from "./schedule-forms";

export const metadata: Metadata = { title: "Horários e regras" };

export default async function HoursPage() {
  await connection();
  const [settings, config] = await Promise.all([getAdminSettings(), getScheduleConfig()]);
  return (
    <>
      <PageHeader title="Horários e regras" back={{ href: "/admin/agenda", label: "Agenda" }} />

      <Section title="Horário de funcionamento" className="mt-0">
        <p className="mb-3 text-sm text-cocoa-soft">Para ter intervalo de almoço, crie duas faixas no mesmo dia (ex.: 08:00–12:00 e 13:30–18:00).</p>
        <WeeklyHoursEditor initial={config.hours.map(({ weekday, opensAt, closesAt }) => ({ weekday, opensAt, closesAt }))} />
      </Section>

      <Section title="Horários especiais">
        <p className="mb-3 text-sm text-cocoa-soft">Num dia com horário especial, valem só as faixas cadastradas aqui. Para não abrir, use Folgas e bloqueios.</p>
        {config.exceptions.length > 0 && (
          <ul className="mb-3 divide-y divide-nude/70 rounded-2xl bg-shell shadow-soft">
            {config.exceptions.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1">
                  <p className="font-medium first-letter:uppercase">{formatLocalDateLong(e.onDate)}</p>
                  <p className="text-sm text-cocoa-soft tabular">
                    {e.opensAt}–{e.closesAt}
                    {e.note && ` · ${e.note}`}
                  </p>
                </div>
                <DeleteExceptionButton id={e.id} />
              </li>
            ))}
          </ul>
        )}
        <ExceptionForm />
      </Section>

      <Section title="Regras de agendamento">
        <RulesForm settings={settings} />
      </Section>
    </>
  );
}
