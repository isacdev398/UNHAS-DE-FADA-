import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/header";
import { getPublishedContent } from "@/lib/data/public";
import { waMessages } from "@/lib/messages";
import { formatPhone, whatsappUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Política de privacidade",
  alternates: { canonical: "/privacidade" },
};

export default async function PrivacyPage() {
  const content = await getPublishedContent();
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-5xl font-medium text-rose-ink">Política de privacidade</h1>
        <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-cocoa [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:text-rose-ink">
          <p>
            Esta política explica como o Unhas de Fada trata seus dados pessoais, de acordo com a Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018).
          </p>
          <h2>Quais dados coletamos</h2>
          <p>
            Ao agendar, pedimos apenas seu <strong>nome</strong> e <strong>WhatsApp</strong>. Também guardamos os serviços
            agendados, datas, valores e pagamentos dos atendimentos.
          </p>
          <h2>Para que usamos</h2>
          <p>
            Para confirmar, lembrar, reagendar ou cancelar seus horários, registrar o histórico de atendimentos e cumprir
            obrigações legais e fiscais. Não vendemos nem compartilhamos seus dados para publicidade.
          </p>
          <h2>Métricas do site</h2>
          <p>
            Contamos visitas e agendamentos de forma anônima, sem cookies de rastreamento e sem guardar seu endereço IP. Se o seu
            navegador pede para não ser rastreado, nada é contado.
          </p>
          <h2>Seu link de agendamento</h2>
          <p>
            Cada agendamento tem um link exclusivo. Não compartilhe esse link: quem o tiver pode ver, reagendar ou cancelar o
            horário. Não é possível consultar agendamentos apenas informando um telefone.
          </p>
          <h2>Por quanto tempo guardamos</h2>
          <p>
            Pelo tempo necessário para o atendimento e para cumprir obrigações legais. Você pode pedir a remoção dos seus dados;
            o histórico financeiro é mantido sem identificar você.
          </p>
          <h2>Seus direitos</h2>
          <p>
            Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo WhatsApp{" "}
            <a href={whatsappUrl(content.whatsapp, waMessages.privacy)} className="font-medium text-rose-deep underline underline-offset-4">
              {formatPhone(content.whatsapp)}
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}
