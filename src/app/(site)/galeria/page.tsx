import type { Metadata } from "next";
import { TrackEvent } from "@/components/site/analytics";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { SiteHeader } from "@/components/site/header";
import { LinkButton } from "@/components/ui/button";
import { IconCalendar, IconImage } from "@/components/ui/icons";
import { getCatalog, getGallery } from "@/lib/data/public";

export const metadata: Metadata = {
  title: "Galeria de trabalhos",
  description: "Fotos reais de unhas feitas no Unhas de Fada. Escolha uma inspiração e agende o mesmo serviço.",
  alternates: { canonical: "/galeria" },
};

export default async function GalleryPage() {
  const [gallery, catalog] = await Promise.all([getGallery(), getCatalog()]);
  return (
    <>
      <TrackEvent kind="page_view" />
      <SiteHeader />
      <main id="conteudo" className="relative overflow-x-clip px-5 pb-12 pt-5">
        <div className="glow -right-16 -top-10 size-64 bg-petal/40" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl">
          <p className="label-caps flex items-center gap-1.5 text-rose-deep">
            <IconImage size={15} /> Portfólio real
          </p>
          <h1 className="mt-1 font-display text-[34px] leading-[42px] font-semibold text-cocoa md:text-5xl md:leading-[56px]">
            Inspirações &amp; <em className="italic text-rose-deep">trabalhos reais</em>
          </h1>
          <p className="mt-2 max-w-lg text-[15px] text-cocoa-soft">
            Fotos de clientes atendidas aqui. Toque em “Quero essa” para agendar o mesmo serviço.
          </p>

          {gallery.length === 0 ? (
            <div className="mt-8 rounded-3xl bg-surface-low px-6 py-12 text-center">
              <p className="font-display text-xl font-semibold text-cocoa">As fotos chegam em breve</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-cocoa-soft">Enquanto isso, veja os serviços e os horários livres.</p>
              <LinkButton href="/agendar" size="lg" className="mt-6">
                <IconCalendar size={18} /> Agendar horário
              </LinkButton>
            </div>
          ) : (
            <GalleryGrid photos={gallery} services={catalog.services} />
          )}
        </div>
      </main>
    </>
  );
}
