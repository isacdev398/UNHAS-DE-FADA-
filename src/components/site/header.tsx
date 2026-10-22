import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { IconCalendar, IconInstagram, IconWhatsApp } from "@/components/ui/icons";
import { getPublishedContent } from "@/lib/data/public";
import { instagramUrl, whatsappUrl } from "@/lib/format";

/** Cabeçalho fixo translúcido: logo + nome da marca, atalhos de contato e (no computador) o menu. */
export async function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  const content = await getPublishedContent();
  return (
    <header className="sticky top-0 z-40 bg-blush/85 shadow-[0_4px_20px_rgb(74_62_61/0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
        <Link href="/" className="flex items-center gap-2 rounded-lg" aria-label="Unhas de Fada — início">
          <Image src="/brand/monogram.png" alt="" width={44} height={34} className="h-8 w-auto" priority />
          <span className="flex flex-col leading-none">
            <span translate="no" className="font-display text-lg font-semibold tracking-tight text-rose-deep">
              Unhas de Fada
            </span>
            <span className="label-caps mt-0.5 !text-[10px] text-cocoa-soft">Manicure</span>
          </span>
        </Link>

        <nav aria-label="Menu" className="hidden items-center gap-7 text-sm font-semibold text-cocoa-soft md:flex">
          <Link href="/#servicos" className="hover:text-rose-deep">
            Serviços
          </Link>
          <Link href="/galeria" className="hover:text-rose-deep">
            Galeria
          </Link>
          <Link href="/#contato" className="hover:text-rose-deep">
            Contato
          </Link>
        </nav>

        <div className="flex items-center gap-1">
          <a
            href={whatsappUrl(content.whatsapp, "Olá! Vim pelo site.")}
            aria-label="Conversar no WhatsApp"
            className="flex size-11 items-center justify-center rounded-full text-cocoa-soft transition-colors hover:bg-nude-soft hover:text-rose-deep"
          >
            <IconWhatsApp size={20} />
          </a>
          {content.instagram && (
            <a
              href={instagramUrl(content.instagram)}
              aria-label={`Instagram @${content.instagram}`}
              className="flex size-11 items-center justify-center rounded-full text-cocoa-soft transition-colors hover:bg-nude-soft hover:text-rose-deep"
            >
              <IconInstagram size={20} />
            </a>
          )}
          {showCta && (
            <span className="ml-1 hidden md:block">
              <LinkButton href="/agendar" size="sm">
                <IconCalendar size={16} /> Agendar
              </LinkButton>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
