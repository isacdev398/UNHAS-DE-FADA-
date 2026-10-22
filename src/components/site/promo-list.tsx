"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { IconArrowRight, IconSparkle } from "@/components/ui/icons";
import type { CatalogPromotion, CatalogService } from "@/lib/data/public";
import { formatBRL, formatDuration } from "@/lib/format";
import { formatLocalDateShort, todayIn } from "@/lib/time";

const subscribe = () => () => {};

/** Promoções vigentes hoje (a data é a do fuso do salão, calculada no navegador). */
export function PromoList({ promotions, services }: { promotions: CatalogPromotion[]; services: CatalogService[] }) {
  const today = useSyncExternalStore(subscribe, () => todayIn("America/Fortaleza"), () => null);
  if (!today) return null;
  const valid = promotions.filter((p) => p.startsOn <= today && today <= p.endsOn);
  if (valid.length === 0) return null;
  const byId = new Map(services.map((s) => [s.id, s]));

  return (
    <section id="promocoes" aria-label="Promoções" className="scroll-mt-20 px-5 pb-4">
      <ul className="mx-auto grid max-w-6xl gap-3 md:grid-cols-2">
        {valid.map((p) => {
          const items = p.serviceIds.map((id) => byId.get(id)).filter((s) => s !== undefined);
          const full = items.reduce((sum, s) => sum + s.priceCents, 0);
          const duration = items.reduce((sum, s) => sum + s.durationMinutes, 0);
          const slugs = items.map((s) => s.slug).join(",");
          return (
            <li key={p.id} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface-high to-nude-soft p-4 shadow-soft">
              <div className="glow -bottom-10 -right-10 size-36 bg-rose/10" aria-hidden="true" />
              <div className="relative flex items-center justify-between gap-2">
                {full > p.promoPriceCents && (
                  <span className="label-caps inline-flex items-center gap-1 rounded-full bg-rose-deep px-2.5 py-1 text-white">
                    <IconSparkle size={13} /> Economize {formatBRL(full - p.promoPriceCents)}
                  </span>
                )}
                <span className="label-caps text-rose-deep">Até {formatLocalDateShort(p.endsOn)}</span>
              </div>
              <h2 className="relative mt-2 font-display text-lg font-semibold text-cocoa">{p.title}</h2>
              <p className="relative text-[13px] text-cocoa-soft">{p.description || items.map((s) => s.name).join(" + ")}</p>
              <div className="relative mt-4 flex items-center justify-between gap-3 rounded-xl bg-shell/80 p-3 backdrop-blur-md">
                <div>
                  {full > p.promoPriceCents && <s className="block text-xs text-outline">De {formatBRL(full)}</s>}
                  <p className="flex items-baseline gap-1">
                    <span className="font-display text-[22px] font-bold text-rose-deep tabular">{formatBRL(p.promoPriceCents)}</span>
                    <span className="text-xs text-cocoa-soft">/ sessão ({formatDuration(duration)})</span>
                  </p>
                </div>
                <Link
                  href={`/agendar?servico=${slugs}`}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-rose-deep px-4 text-[13px] font-semibold text-white shadow-cta transition-transform active:scale-95"
                >
                  Quero este <IconArrowRight size={16} />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
