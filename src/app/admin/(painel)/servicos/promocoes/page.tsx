import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader, Section } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import { getAdminSettings, listPromotions, listServices } from "@/lib/data/admin";
import { formatBRL } from "@/lib/format";
import { addDays, formatLocalDateShort, todayIn } from "@/lib/time";
import { PromotionForm, PromotionToggle } from "./promotion-forms";

export const metadata: Metadata = { title: "Promoções" };

export default async function PromotionsPage() {
  await connection();
  const [settings, { services }, promotions] = await Promise.all([getAdminSettings(), listServices(), listPromotions()]);
  const today = todayIn(settings.tz);
  const byId = new Map(services.map((s) => [s.id, s]));

  return (
    <>
      <PageHeader title="Promoções" back={{ href: "/admin/servicos", label: "Serviços" }} description="Escolha os serviços, o preço promocional e até quando vale. O resto é automático." />
      <PromotionForm
        services={services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, priceCents: s.priceCents }))}
        today={today}
        defaultEnd={addDays(today, 14)}
      />
      <Section title="Suas promoções">
        {promotions.length === 0 ? (
          <p className="text-sm text-cocoa-soft">Nenhuma promoção criada.</p>
        ) : (
          <ul className="divide-y divide-nude/70 rounded-2xl bg-shell shadow-soft">
            {promotions.map((p) => {
              const expired = p.endsOn < today;
              const upcoming = p.startsOn > today;
              const full = p.serviceIds.reduce((s, id) => s + (byId.get(id)?.priceCents ?? 0), 0);
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {p.title}{" "}
                      {expired ? <Badge tone="neutral">Encerrada</Badge> : !p.active ? <Badge tone="neutral">Pausada</Badge> : upcoming ? <Badge tone="amber">Agendada</Badge> : <Badge tone="sage">No ar</Badge>}
                    </p>
                    <p className="text-sm text-cocoa-soft">{p.serviceIds.map((id) => byId.get(id)?.name).join(" + ")}</p>
                    <p className="text-sm tabular">
                      <s className="text-cocoa-soft">{formatBRL(full)}</s> {formatBRL(p.promoPriceCents)} · {formatLocalDateShort(p.startsOn)} a {formatLocalDateShort(p.endsOn)}
                    </p>
                  </div>
                  {!expired && <PromotionToggle id={p.id} active={p.active} title={p.title} />}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
