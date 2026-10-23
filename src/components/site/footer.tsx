import Link from "next/link";
import type { SiteContent } from "@/lib/content";
import { waMessages } from "@/lib/messages";
import { formatPhone, instagramUrl, whatsappUrl } from "@/lib/format";

export function SiteFooter({ content }: { content: SiteContent }) {
  return (
    <footer className="bg-surface-low pb-28 pt-10 md:pb-12">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 text-sm text-cocoa-soft sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <p translate="no" className="font-display text-xl font-semibold text-rose-deep">
            Unhas de Fada
          </p>
          {content.address && (
            <p>
              {content.address}
              {content.city && `, ${content.city}`}
            </p>
          )}
          <p>
            <a className="underline-offset-4 hover:underline" href={whatsappUrl(content.whatsapp, waMessages.general)}>
              WhatsApp {formatPhone(content.whatsapp)}
            </a>
            {content.instagram && (
              <>
                {" · "}
                <a className="underline-offset-4 hover:underline" href={instagramUrl(content.instagram)}>
                  @{content.instagram}
                </a>
              </>
            )}
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap items-end gap-x-5 gap-y-2 sm:flex-col sm:items-end">
          <Link className="underline-offset-4 hover:underline" href="/privacidade">
            Privacidade
          </Link>
          <Link className="underline-offset-4 hover:underline" href="/admin">
            Área da profissional
          </Link>
        </nav>
      </div>
    </footer>
  );
}
