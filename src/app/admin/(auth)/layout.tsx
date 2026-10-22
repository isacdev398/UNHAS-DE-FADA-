import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Image src="/brand/logo.png" alt="Unhas de Fada" width={900} height={830} className="mx-auto h-auto w-44" priority />
      <div className="mt-8 rounded-3xl bg-shell p-6 shadow-soft ring-1 ring-nude">{children}</div>
    </main>
  );
}
