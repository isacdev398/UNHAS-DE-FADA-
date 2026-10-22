import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Section, Stat } from "@/components/admin/ui";
import { createSessionClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Métricas" };

const RANGES = [7, 30, 90];

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function MetricsPage({ searchParams }: PageProps<"/admin/configuracoes/metricas">) {
  await connection();
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const since = daysAgoIso(days);
  const db = await createSessionClient();
  const { data } = await db.from("analytics_events").select("kind, source").gte("created_at", since).limit(50_000);
  const events = (data ?? []) as { kind: string; source: string | null }[];

  const count = (k: string) => events.filter((e) => e.kind === k).length;
  const visits = count("page_view");
  const starts = count("booking_start");
  const done = count("booking_complete");
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  const sources = new Map<string, { visits: number; done: number }>();
  for (const e of events) {
    const key = e.source ?? "direto";
    const s = sources.get(key) ?? { visits: 0, done: 0 };
    if (e.kind === "page_view") s.visits++;
    if (e.kind === "booking_complete") s.done++;
    sources.set(key, s);
  }

  return (
    <>
      <PageHeader title="Métricas do site" back={{ href: "/admin/configuracoes", label: "Configurações" }} description="Contagem anônima: sem cookies e sem dados pessoais." />
      <div className="mb-4 flex gap-1 rounded-pill bg-shell p-1 ring-1 ring-nude" role="tablist" aria-label="Período">
        {RANGES.map((d) => (
          <Link key={d} href={`/admin/configuracoes/metricas?dias=${d}`} role="tab" aria-selected={d === days} className={`flex min-h-10 flex-1 items-center justify-center rounded-pill text-sm font-medium ${d === days ? "bg-rose-deep text-shell" : "text-cocoa-soft"}`}>
            {d} dias
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Visitas" value={visits} />
        <Stat label="Iniciaram agendamento" value={starts} hint={`${pct(starts, visits)} das visitas`} />
        <Stat label="Agendaram" value={done} tone="good" hint={`${pct(done, visits)} das visitas`} />
      </div>
      <p className="mt-2 text-sm text-cocoa-soft">De quem começou a agendar, {pct(done, starts)} concluiu.</p>

      <Section title="Origem das visitas">
        {sources.size === 0 ? (
          <p className="text-sm text-cocoa-soft">Sem dados no período.</p>
        ) : (
          <table className="w-full overflow-hidden rounded-2xl bg-shell text-sm shadow-soft">
            <thead className="text-left text-cocoa-soft">
              <tr>
                <th className="px-4 py-2 font-medium">Origem</th>
                <th className="px-4 py-2 text-right font-medium">Visitas</th>
                <th className="px-4 py-2 text-right font-medium">Agendaram</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nude/70">
              {[...sources].sort((a, b) => b[1].visits - a[1].visits).map(([name, s]) => (
                <tr key={name}>
                  <td className="px-4 py-2.5 capitalize">{name}</td>
                  <td className="px-4 py-2.5 text-right tabular">{s.visits}</td>
                  <td className="px-4 py-2.5 text-right tabular">{s.done}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-cocoa-soft">Dica: no link da bio, use ?utm_source=instagram-bio para separar a origem.</p>
      </Section>
    </>
  );
}
