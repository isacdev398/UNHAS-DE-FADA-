"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconHome, IconSettings, IconSparkle, IconUsers, IconWallet } from "@/components/ui/icons";

const ITEMS = [
  { href: "/admin", label: "Início", icon: IconHome, exact: true },
  { href: "/admin/agenda", label: "Agenda", icon: IconCalendar },
  { href: "/admin/clientes", label: "Clientes", icon: IconUsers },
  { href: "/admin/financeiro", label: "Financeiro", icon: IconWallet },
  { href: "/admin/servicos", label: "Serviços", icon: IconSparkle },
  { href: "/admin/configuracoes", label: "Configurações", icon: IconSettings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  return <AdminNavView pathname={usePathname()} />;
}

/** Barra inferior no celular, lateral no computador. */
export function AdminNavView({ pathname }: { pathname: string }) {
  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-nude/80 bg-blush/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <ul className="grid grid-cols-[1fr_1fr_1fr_1.1fr_1fr_1.25fr]">
          {ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <li key={href} className="min-w-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] leading-tight font-semibold tracking-[-0.02em] ${active ? "text-rose-deep" : "text-cocoa-soft"}`}
                >
                  <span className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${active ? "bg-petal-soft" : ""}`}>
                    <Icon size={20} strokeWidth={active ? 2 : 1.6} />
                  </span>
                  <span className="whitespace-nowrap">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label="Navegação principal" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-shell p-4 shadow-soft md:flex">
        <Link href="/admin" className="mb-6 flex flex-col px-3 leading-none" translate="no">
          <span className="font-display text-xl font-semibold text-rose-deep">Unhas de Fada</span>
          <span className="label-caps mt-1 !text-[10px] text-cocoa-soft">Painel de gestão</span>
        </Link>
        <ul className="space-y-1">
          {ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-rose-deep text-white shadow-cta" : "text-cocoa-soft hover:bg-nude-soft"}`}
                >
                  <Icon size={20} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
