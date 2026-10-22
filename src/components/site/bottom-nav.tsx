"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconChat, IconHome, IconImage } from "@/components/ui/icons";

const ITEMS = [
  { href: "/", label: "Início", icon: IconHome, match: (p: string) => p === "/" },
  { href: "/agendar", label: "Agendar", icon: IconCalendar, match: (p: string) => p.startsWith("/agendar") || p.startsWith("/meu-agendamento") },
  { href: "/galeria", label: "Galeria", icon: IconImage, match: (p: string) => p.startsWith("/galeria") },
  { href: "/#contato", label: "Contato", icon: IconChat, match: () => false },
];

/** Barra de navegação inferior do site no celular (some no computador). */
export function SiteBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-nude/80 bg-blush/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-rose-deep" : "text-cocoa-soft"}`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-petal-soft" : ""}`}>
                  <Icon size={21} strokeWidth={active ? 2 : 1.6} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
