import type { Metadata } from "next";
import { connection } from "next/server";
import type { ComponentType } from "react";
import { List, ListLink, PageHeader } from "@/components/admin/ui";
import {
  IconCalendar,
  IconChevronRight,
  IconClock,
  IconExternal,
  IconHome,
  IconLock,
  IconSearch,
  IconSparkle,
  IconStar,
  IconWallet,
  IconWhatsApp,
} from "@/components/ui/icons";
import { getAdmin } from "@/lib/auth";
import { signOut } from "../../(auth)/actions";

export const metadata: Metadata = { title: "Configurações" };

type Item = { href: string; label: string; hint?: string; icon: ComponentType<{ size?: number; className?: string }> };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Seu site",
    items: [
      { href: "/admin/configuracoes/site", label: "Textos, contatos e foto de capa", hint: "Com pré-visualização antes de publicar", icon: IconHome },
      { href: "/admin/configuracoes/galeria", label: "Galeria de trabalhos", hint: "Enviar e organizar fotos", icon: IconSparkle },
      { href: "/admin/configuracoes/avaliacoes", label: "Avaliações de clientes", icon: IconStar },
    ],
  },
  {
    title: "Agenda",
    items: [
      { href: "/admin/agenda/horarios", label: "Horários de atendimento", hint: "Dias, horários, intervalo e regras de agendamento", icon: IconClock },
      { href: "/admin/agenda/bloqueios", label: "Folgas, feriados e férias", icon: IconCalendar },
    ],
  },
  {
    title: "Serviços e pagamentos",
    items: [
      { href: "/admin/servicos", label: "Serviços e preços", hint: "Preço, duração e o que aparece no site", icon: IconSparkle },
      { href: "/admin/servicos/promocoes", label: "Promoções", icon: IconSparkle },
      { href: "/admin/configuracoes/pagamentos", label: "Formas de pagamento", icon: IconWallet },
      { href: "/admin/configuracoes/whatsapp", label: "Mensagens automáticas de WhatsApp", hint: "Desativado", icon: IconWhatsApp },
    ],
  },
  {
    title: "Acompanhamento",
    items: [
      { href: "/admin/configuracoes/metricas", label: "Métricas do site", hint: "Visitas e agendamentos", icon: IconSearch },
      { href: "/admin/configuracoes/auditoria", label: "Histórico de alterações", icon: IconClock },
    ],
  },
];

export default async function SettingsPage() {
  await connection();
  const admin = await getAdmin();
  return (
    <>
      <PageHeader title="Configurações" description="Tudo o que você pode personalizar, em um só lugar." />
      <div className="space-y-6">
        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`grupo-${g.title}`}>
            <h2 id={`grupo-${g.title}`} className="mb-2 text-sm font-medium text-cocoa-soft">
              {g.title}
            </h2>
            <List>
              {g.items.map(({ href, label, hint, icon: Icon }) => (
                <li key={href}>
                  <ListLink href={href}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-nude-soft text-rose-deep">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{label}</span>
                      {hint && <span className="block text-sm text-cocoa-soft">{hint}</span>}
                    </span>
                    <IconChevronRight size={18} className="shrink-0 text-cocoa-soft" />
                  </ListLink>
                </li>
              ))}
            </List>
          </section>
        ))}

        <section aria-labelledby="grupo-conta">
          <h2 id="grupo-conta" className="mb-2 text-sm font-medium text-cocoa-soft">
            Sua conta{admin?.email && <span className="font-normal"> · {admin.email}</span>}
          </h2>
          <List>
            <li>
              <ListLink href="/admin/nova-senha">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-nude-soft text-rose-deep">
                  <IconLock size={18} />
                </span>
                <span className="flex-1 font-medium">Trocar senha</span>
                <IconChevronRight size={18} className="text-cocoa-soft" />
              </ListLink>
            </li>
            <li>
              <a href="/" target="_blank" rel="noreferrer" className="flex min-h-14 items-center gap-3 px-4 py-3 font-medium hover:bg-nude-soft/60">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-nude-soft text-rose-deep">
                  <IconExternal size={18} />
                </span>
                <span className="flex-1">Ver o site como cliente</span>
              </a>
            </li>
            <li>
              <form action={signOut}>
                <button type="submit" className="flex min-h-14 w-full items-center px-4 text-left font-medium text-danger hover:bg-danger-soft/50">
                  Sair
                </button>
              </form>
            </li>
          </List>
        </section>
      </div>
    </>
  );
}
