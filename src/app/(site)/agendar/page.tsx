import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackEvent } from "@/components/site/analytics";
import { BookingFlow } from "@/components/site/booking-flow";
import { SiteHeader } from "@/components/site/header";
import { getBookingPolicy, getCatalog, getGallery, getPublishedContent } from "@/lib/data/public";

export const metadata: Metadata = {
  title: "Agendar horário",
  description: "Escolha o serviço, veja os horários livres e agende em poucos toques.",
  alternates: { canonical: "/agendar" },
};

export default async function BookingPage() {
  const [catalog, content, policy, gallery] = await Promise.all([getCatalog(), getPublishedContent(), getBookingPolicy(), getGallery()]);
  // Primeira foto (destaques vêm antes) de cada serviço, para a miniatura do cartão
  const photos: Record<string, string> = {};
  for (const p of gallery) if (p.serviceId && !photos[p.serviceId]) photos[p.serviceId] = p.url;

  return (
    <>
      <TrackEvent kind="page_view" />
      <SiteHeader showCta={false} />
      <main id="conteudo" className="mx-auto max-w-2xl overflow-x-clip px-5 pb-48 pt-5">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-shell/60" />}>
          <BookingFlow catalog={catalog} whatsapp={content.whatsapp} policy={policy} photos={photos} />
        </Suspense>
      </main>
    </>
  );
}
