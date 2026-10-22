import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { IconExternal } from "@/components/ui/icons";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminNav, AdminNavView } from "@/components/admin/nav";
import { requireAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel Unhas de Fada" },
  robots: { index: false, follow: false },
};

async function Gate({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-2xl bg-amber-soft p-5 text-amber">
        <p className="font-semibold">Supabase ainda não configurado</p>
        <p className="mt-1 text-sm">Defina as variáveis de ambiente (veja o README) para usar o painel.</p>
      </div>
    );
  }
  // A checagem de sessão usa a hora atual (validade do token): sempre por requisição.
  await connection();
  await requireAdmin();
  return <>{children}</>;
}

function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-nude-soft" />
      <div className="h-28 animate-pulse rounded-2xl bg-shell" />
      <div className="h-64 animate-pulse rounded-2xl bg-shell" />
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-blush">
      <Suspense fallback={<AdminNavView pathname="" />}>
        <AdminNav />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior no celular: marca + atalho para o site */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-blush/85 px-4 shadow-[0_4px_20px_rgb(74_62_61/0.04)] backdrop-blur-xl md:hidden">
          <Link href="/admin" className="flex items-center gap-2" translate="no">
            <Image src="/brand/monogram.png" alt="" width={40} height={31} className="h-7 w-auto" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-base font-semibold text-rose-deep">Unhas de Fada</span>
              <span className="label-caps mt-0.5 !text-[9px] text-cocoa-soft">Painel</span>
            </span>
          </Link>
          <a href="/" target="_blank" rel="noreferrer" className="flex size-10 items-center justify-center rounded-full text-cocoa-soft hover:bg-nude-soft" aria-label="Ver o site">
            <IconExternal size={19} />
          </a>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-3xl min-w-0 px-4 pb-28 pt-4 sm:px-6 md:pb-12 md:pt-8">
          <Suspense fallback={<Loading />}>
            <Gate>{children}</Gate>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
