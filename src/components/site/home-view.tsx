import Image from "next/image";
import Link from "next/link";
import { TrackEvent } from "@/components/site/analytics";
import { SiteHeader } from "@/components/site/header";
import { PromoList } from "@/components/site/promo-list";
import { RichTitle } from "@/components/site/rich-title";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { IconCalendar, IconChevronRight, IconClock, IconInstagram, IconPin, IconPlus, IconStar, IconWhatsApp } from "@/components/ui/icons";
import type { SiteContent } from "@/lib/content";
import type { Catalog, GalleryPhoto, Testimonial } from "@/lib/data/public";
import { storagePublicUrl } from "@/lib/env";
import { waMessages } from "@/lib/messages";
import { formatBRLShort, formatDuration, instagramUrl, whatsappUrl } from "@/lib/format";

type Props = { content: SiteContent; catalog: Catalog; gallery: GalleryPhoto[]; testimonials: Testimonial[]; preview?: boolean };

/** Página inicial. Usada pelo site e pela pré-visualização do painel. */
export function HomeView({ content, catalog, gallery, testimonials, preview = false }: Props) {
  const serviceById = new Map(catalog.services.map((s) => [s.id, s]));
  const categoryById = new Map(catalog.categories.map((c) => [c.id, c.name]));
  const heroImage = content.heroImagePath ? storagePublicUrl(content.heroImagePath) : "";
  const aboutImage = content.aboutImagePath ? storagePublicUrl(content.aboutImagePath) : "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NailSalon",
    name: "Unhas de Fada",
    telephone: `+${content.whatsapp}`,
    address: content.address ? { "@type": "PostalAddress", streetAddress: content.address, addressLocality: content.city || undefined } : undefined,
    sameAs: content.instagram ? [instagramUrl(content.instagram)] : undefined,
    makesOffer: catalog.services.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s.name },
      price: (s.priceCents / 100).toFixed(2),
      priceCurrency: "BRL",
    })),
  };

  return (
    <>
      {!preview && <TrackEvent kind="page_view" />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteHeader />

      <main id="conteudo" className="overflow-x-clip">
        {/* Abertura */}
        <section className="relative px-5 pb-8 pt-5 md:pb-16 md:pt-12">
          <div className="glow -right-16 -top-16 size-72 bg-petal/40" aria-hidden="true" />
          <div className="glow -left-20 top-48 size-60 bg-petal-soft/60" aria-hidden="true" />
          <div className={`relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 ${heroImage ? "md:grid-cols-[1.1fr_1fr]" : "md:max-w-2xl"}`}>
            <div className="flex min-w-0 flex-col gap-4 motion-safe:animate-rise">
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-surface-high px-3.5 py-1.5 text-rose-deep shadow-sm">
                <IconCalendar size={15} />
                <span className="label-caps">Agendamento online · sem cadastro</span>
              </span>
              <div className="space-y-2">
                <h1 className="font-display text-[34px] leading-[42px] font-semibold tracking-[-0.01em] text-cocoa md:text-5xl md:leading-[56px]">
                  <RichTitle text={content.heroTitle} />
                </h1>
                {content.heroSubtitle && <p className="max-w-md text-[15px] leading-relaxed text-cocoa-soft md:text-base">{content.heroSubtitle}</p>}
              </div>

              {/* Cartão da marca */}
              <div className="flex items-center gap-3.5 rounded-2xl bg-shell p-3 shadow-soft">
                <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-nude-soft">
                  <Image src="/brand/monogram.png" alt="" width={120} height={92} className="h-12 w-auto" />
                </div>
                <div className="min-w-0">
                  <p translate="no" className="font-display text-lg leading-tight font-semibold text-cocoa">
                    Unhas de Fada
                  </p>
                  <p className="text-[13px] text-cocoa-soft">Manicure e pedicure com hora marcada</p>
                  {content.address && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-outline">
                      <IconPin size={14} className="shrink-0 text-rose" />
                      <span className="truncate">{content.address}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                <LinkButton href="/agendar" size="lg" className="w-full md:w-auto md:self-start md:px-10">
                  <IconCalendar size={20} /> Agendar horário online
                </LinkButton>
                <p className="flex items-center justify-center gap-1.5 text-xs text-cocoa-soft md:justify-start">
                  <IconClock size={15} className="text-rose-deep" /> Agendamento rápido, em menos de 1 minuto
                </p>
              </div>
            </div>

            {heroImage && (
              <div className="relative mx-auto w-full max-w-sm">
                <Image
                  src={heroImage}
                  alt="Unhas feitas no Unhas de Fada"
                  width={720}
                  height={900}
                  priority
                  sizes="(max-width: 768px) 90vw, 384px"
                  className="aspect-[4/5] w-full rounded-3xl object-cover shadow-lift"
                />
              </div>
            )}
          </div>
        </section>

        <PromoList promotions={catalog.promotions} services={catalog.services} />

        {/* Serviços e preços */}
        <section id="servicos" aria-labelledby="servicos-titulo" className="scroll-mt-20 px-5 pb-10 pt-4">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="label-caps text-rose-deep">Menu de cuidados</p>
                <h2 id="servicos-titulo" className="font-display text-[22px] leading-[30px] font-semibold text-cocoa md:text-[32px] md:leading-10">
                  Serviços &amp; preços
                </h2>
              </div>
              <span className="label-caps shrink-0 rounded-md bg-nude-soft px-2.5 py-1 !text-[10px] text-cocoa-soft">Valores transparentes</span>
            </div>
            <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {catalog.services.map((s) => (
                <li key={s.id} className="flex items-stretch justify-between gap-3 rounded-2xl bg-shell p-4 shadow-soft transition-shadow hover:shadow-lift">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold text-cocoa">{s.name}</h3>
                    {s.description && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-cocoa-soft">{s.description}</p>}
                    <p className="label-caps mt-2.5 flex items-center gap-2 text-outline">
                      <span className="flex items-center gap-1">
                        <IconClock size={14} /> {formatDuration(s.durationMinutes)}
                      </span>
                      {s.categoryId && categoryById.get(s.categoryId) && (
                        <>
                          <span aria-hidden="true">•</span>
                          <span className="text-antique">{categoryById.get(s.categoryId)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-between gap-3">
                    <span className="font-display text-lg font-bold text-rose-deep tabular">{formatBRLShort(s.priceCents)}</span>
                    <Link href={`/agendar?servico=${s.slug}`} className={buttonClass("soft", "sm", "h-9 rounded-lg px-3")} aria-label={`Agendar ${s.name}`}>
                      Agendar <IconPlus size={14} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Galeria */}
        {gallery.length > 0 && (
          <section aria-labelledby="galeria-titulo" className="bg-surface-low py-8">
            <div className="mx-auto max-w-6xl">
              <div className="flex items-end justify-between gap-3 px-5">
                <div>
                  <p className="label-caps text-rose-deep">Portfólio real</p>
                  <h2 id="galeria-titulo" className="font-display text-[22px] leading-[30px] font-semibold text-cocoa md:text-[32px] md:leading-10">
                    Galeria de criações
                  </h2>
                </div>
                <Link href="/galeria" className="flex min-h-11 items-center gap-0.5 text-[13px] font-semibold text-rose-deep">
                  Ver mais <IconChevronRight size={16} />
                </Link>
              </div>
              <ul className="scrollbar-none mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2 pt-1">
                {gallery.slice(0, 10).map((photo, i) => {
                  const service = photo.serviceId ? serviceById.get(photo.serviceId) : undefined;
                  return (
                    <li key={photo.id} className="w-48 shrink-0 snap-start overflow-hidden rounded-2xl bg-shell shadow-soft md:w-60">
                      <Link href={service ? `/agendar?servico=${service.slug}` : "/galeria"} className="block">
                        <div className="relative h-56 md:h-72">
                          <Image
                            src={photo.url}
                            alt={photo.alt || (service ? `Unhas — ${service.name}` : "Unhas feitas no Unhas de Fada")}
                            fill
                            sizes="240px"
                            loading={i < 3 ? "eager" : "lazy"}
                            className="object-cover"
                          />
                          {service && (
                            <span className="label-caps absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 !text-[10px] text-white backdrop-blur-md">
                              {service.name}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 p-2.5 text-[13px] font-semibold text-cocoa">{photo.alt || (service ? `Agendar ${service.name}` : "Ver na galeria")}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* Avaliações */}
        {testimonials.length > 0 && (
          <section aria-labelledby="avaliacoes-titulo" className="px-5 py-10">
            <div className="mx-auto max-w-6xl">
              <div className="text-center">
                <p className="flex justify-center gap-1 text-antique" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <IconStar key={i} size={18} fill="currentColor" />
                  ))}
                </p>
                <h2 id="avaliacoes-titulo" className="mt-2 font-display text-[22px] leading-[30px] font-semibold text-cocoa md:text-[32px] md:leading-10">
                  O que as clientes dizem
                </h2>
              </div>
              <ul className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {testimonials.map((t) => (
                  <li key={t.id} className="rounded-2xl bg-shell p-5 shadow-soft">
                    {t.rating && (
                      <p className="flex gap-0.5 text-antique" aria-label={`${t.rating} de 5 estrelas`}>
                        {Array.from({ length: t.rating }, (_, i) => (
                          <IconStar key={i} size={14} fill="currentColor" />
                        ))}
                      </p>
                    )}
                    <blockquote className="mt-2 font-display text-[15px] leading-relaxed text-cocoa italic">“{t.body}”</blockquote>
                    <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-cocoa">
                      <span className="flex size-7 items-center justify-center rounded-full bg-petal-soft text-xs text-rose-deep" aria-hidden="true">
                        {t.authorName.charAt(0).toUpperCase()}
                      </span>
                      {t.authorName}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Nosso espaço e contato */}
        <section id="contato" aria-labelledby="contato-titulo" className="scroll-mt-20 px-5 pb-12 pt-6">
          <div className="mx-auto max-w-6xl rounded-3xl bg-shell p-5 shadow-soft md:p-8">
            <h2 id="contato-titulo" className="flex items-center gap-2 font-display text-[22px] leading-[30px] font-semibold text-cocoa">
              <IconPin className="text-rose-deep" /> {content.aboutTitle || "Nosso espaço"}
            </h2>
            <div className={`mt-3 grid gap-5 ${aboutImage ? "md:grid-cols-2" : ""}`}>
              <div className="space-y-4">
                {content.about && <p className="text-[15px] leading-relaxed text-cocoa-soft">{content.about}</p>}
                <div className="grid gap-2 sm:grid-cols-2">
                  {content.address && (
                    <div className="rounded-xl bg-surface-low p-3">
                      <p className="label-caps text-outline">Endereço</p>
                      <p className="mt-0.5 text-sm font-semibold text-cocoa">
                        {content.address}
                        {content.city && <span className="block font-normal text-cocoa-soft">{content.city}</span>}
                      </p>
                      {content.mapsUrl && (
                        <a href={content.mapsUrl} className="mt-1 inline-block text-[13px] font-semibold text-rose-deep underline underline-offset-4">
                          Abrir no mapa
                        </a>
                      )}
                    </div>
                  )}
                  <div className="rounded-xl bg-surface-low p-3">
                    <p className="label-caps text-outline">Atendimento</p>
                    <p className="mt-0.5 text-sm font-semibold text-cocoa">{content.hoursNote || "Com hora marcada"}</p>
                    <Link href="/agendar" className="mt-1 inline-block text-[13px] font-semibold text-rose-deep underline underline-offset-4">
                      Ver horários livres
                    </Link>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <a href={whatsappUrl(content.whatsapp, waMessages.general)} className={buttonClass("soft", "lg", "w-full")}>
                    <IconWhatsApp size={18} /> WhatsApp direto
                  </a>
                  {content.instagram && (
                    <a href={instagramUrl(content.instagram)} className={buttonClass("soft", "lg", "w-full")}>
                      <IconInstagram size={18} /> @{content.instagram}
                    </a>
                  )}
                </div>
              </div>
              {aboutImage && (
                <Image
                  src={aboutImage}
                  alt="Espaço de atendimento do Unhas de Fada"
                  width={800}
                  height={600}
                  sizes="(max-width: 768px) 92vw, 520px"
                  className="aspect-[4/3] w-full rounded-2xl object-cover"
                />
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
