"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { IconClock } from "@/components/ui/icons";
import type { CatalogService, GalleryPhoto } from "@/lib/data/public";
import { formatBRL, formatDuration } from "@/lib/format";

/** Galeria em cartões grandes, com filtro por serviço (chips). */
export function GalleryGrid({ photos, services }: { photos: GalleryPhoto[]; services: CatalogService[] }) {
  const byId = new Map(services.map((s) => [s.id, s]));
  const used = services.filter((s) => photos.some((p) => p.serviceId === s.id));
  const [filter, setFilter] = useState<string | null>(null);
  const shown = filter ? photos.filter((p) => p.serviceId === filter) : photos;

  return (
    <>
      {used.length > 0 && (
        <div className="scrollbar-none -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Filtrar por serviço">
          {[{ id: null as string | null, name: "Todas" }, ...used.map((s) => ({ id: s.id as string | null, name: s.name }))].map((chip) => {
            const active = chip.id === filter;
            return (
              <button
                key={chip.id ?? "todas"}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(chip.id)}
                className={`h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-[background-color,color,box-shadow] ${
                  active ? "bg-rose-deep text-white shadow-cta" : "bg-champagne/60 text-cocoa ring-1 ring-inset ring-antique/20"
                }`}
              >
                {chip.name}
              </button>
            );
          })}
        </div>
      )}

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((photo, i) => {
          const service = photo.serviceId ? byId.get(photo.serviceId) : undefined;
          return (
            <li key={photo.id} className="overflow-hidden rounded-3xl bg-shell shadow-soft">
              <div className="relative aspect-[4/5]">
                <Image
                  src={photo.url}
                  alt={photo.alt || (service ? `Unhas — ${service.name}` : "Unhas feitas no Unhas de Fada")}
                  fill
                  sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 380px"
                  loading={i < 2 ? "eager" : "lazy"}
                  className="object-cover"
                />
                {photo.featured && (
                  <span className="label-caps absolute left-3 top-3 rounded-full bg-shell/90 px-2.5 py-1 !text-[10px] text-rose-deep backdrop-blur-md">
                    Destaque
                  </span>
                )}
                {service && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <IconClock size={14} /> {service.name} · {formatDuration(service.durationMinutes)}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold text-cocoa">
                    {service?.name ?? "Trabalho realizado"}
                    {service && <span className="ml-2 font-sans text-[13px] font-semibold text-rose-deep tabular">{formatBRL(service.priceCents)}</span>}
                  </p>
                  {photo.alt && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-cocoa-soft">{photo.alt}</p>}
                </div>
                <Link
                  href={service ? `/agendar?servico=${service.slug}` : "/agendar"}
                  className="inline-flex h-10 shrink-0 items-center rounded-xl bg-rose-deep px-4 text-[13px] font-semibold text-white shadow-cta transition-transform active:scale-95"
                >
                  Quero essa
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
