import type { Metadata, Viewport } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Unhas de Fada · Manicure e pedicure com horário marcado",
    template: "%s · Unhas de Fada",
  },
  description:
    "Manicure e pedicure com carinho e capricho. Veja os preços, escolha o serviço e agende seu horário online em poucos toques.",
  applicationName: "Unhas de Fada",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Unhas de Fada",
    title: "Unhas de Fada · Agende seu horário",
    description: "Manicure e pedicure. Veja os horários livres e agende online em poucos toques.",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#fff8f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${jakarta.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-dvh antialiased">
        <a
          href="#conteudo"
          className="sr-only z-50 rounded-full bg-rose-deep px-4 py-2 text-shell focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
