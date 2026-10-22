import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Section } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/button";
import { IconPlus, IconSparkle } from "@/components/ui/icons";
import { Badge } from "@/components/ui/misc";
import { getAdminSettings, listPromotions, listServices } from "@/lib/data/admin";
import { formatBRL, formatDuration } from "@/lib/format";
import { todayIn } from "@/lib/time";
import { ActiveToggle } from "./service-forms";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicesPage() {
  await connection();
  const [{ services, categories }, promotions, settings] = await Promise.all([listServices(), listPromotions(), getAdminSettings()]);
  const today = todayIn(settings.tz);
  const livePromos = promotions.filter((p) => p.active && p.endsOn >= today);
  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: services.filter((s) => s.categoryId === c.id) })),
    { id: "none", name: "Sem categoria", items: services.filter((s) => !s.categoryId) },
  ].filter((g) => g.items.length);

  return (
    <>
      <PageHeader
        title="Serviços"
        actions={
          <LinkButton href="/admin/servicos/novo" size="sm" aria-label="Novo serviço">
            <IconPlus size={18} /> <span className="hidden sm:inline">Novo</span>
          </LinkButton>
        }
      />

      <Link href="/admin/servicos/promocoes" className="flex items-center gap-3 rounded-2xl bg-rose-deep px-4 py-4 text-shell shadow-soft">
        <IconSparkle />
        <span className="flex-1">
          <span className="block font-semibold">Promoções</span>
          <span className="text-sm text-nude">{livePromos.length ? `${livePromos.length} ativa(s)` : "Criar uma promoção"}</span>
        </span>
      </Link>

      {groups.map((g) => (
        <Section key={g.id} title={g.name}>
          <ul className="divide-y divide-nude/70 rounded-2xl bg-shell shadow-soft">
            {g.items.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                <Link href={`/admin/servicos/${s.id}`} className="flex min-h-12 min-w-0 flex-1 flex-col justify-center">
                  <span className={`font-medium ${s.active ? "" : "text-cocoa-soft"}`}>
                    {s.name} {!s.active && <Badge tone="neutral">Oculto</Badge>}
                  </span>
                  <span className="text-sm text-cocoa-soft tabular">
                    {formatBRL(s.priceCents)} · {formatDuration(s.durationMinutes)}
                  </span>
                </Link>
                <ActiveToggle id={s.id} active={s.active} label={s.name} />
              </li>
            ))}
          </ul>
        </Section>
      ))}
      <p className="mt-4 text-sm text-cocoa-soft">Desligar um serviço tira ele do site e do agendamento online. O histórico continua guardado.</p>
    </>
  );
}
