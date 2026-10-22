@AGENTS.md

# Unhas de Fada — guia do projeto

Plataforma da marca **Unhas de Fada** (manicure e pedicure): site público com agendamento online, painel administrativo para uma profissional (agenda, clientes, financeiro, serviços, conteúdo) e base preparada para crescer (várias profissionais, WhatsApp automático).

Idioma do produto, do código de interface e dos comentários: **português do Brasil**.

## Stack

- **Next.js 16** (App Router, Turbopack, **Cache Components** + Partial Prefetching ativados), React 19, TypeScript estrito.
- **Tailwind CSS v4** — tokens em `src/app/globals.css` (`@theme`).
- **Supabase**: Postgres, Auth (só administradoras), Storage (galeria). Clientes **não** têm login.
- **Zod 4** para validar toda entrada no servidor.
- **Vitest** + **PGlite** (Postgres real em WASM) para testes de domínio e de banco.
- Hospedagem: **Vercel**.

Antes de mexer em APIs do Next, leia o guia correspondente em `node_modules/next/dist/docs/` — esta versão difere do que costuma estar em material de treino (ex.: `proxy.ts` no lugar de `middleware.ts`, `updateTag`, `connection()`, `PageProps<"/rota">`).

## Comandos

```bash
npm run dev          # desenvolvimento (http://localhost:3000)
npm run build        # build de produção
npm run typecheck    # gera tipos de rota + tsc
npm run lint
npm test             # unitários + banco (PGlite)
npm run test:db      # só testes de banco (migrations, RLS, concorrência)
```

## Organização

```
src/
  app/
    (site)/               site público: home, /agendar, /meu-agendamento/[token], /privacidade
    admin/(auth)/         login, recuperação e troca de senha
    admin/(painel)/       painel: início, agenda, clientes, financeiro, servicos, configuracoes/*
    admin/previa/         pré-visualização do conteúdo em rascunho
    api/disponibilidade   horários livres (somente datas/horas, nunca dados de clientes)
    api/track             métricas anônimas
    api/cron/notificacoes fila de WhatsApp (protegida por CRON_SECRET)
  components/ui           design system (botões, formulários, ícones, preço)
  components/site         componentes do site público (fluxo de agendamento, seletor de horários)
  components/admin        navegação e blocos do painel
  lib/                    domínio puro (testável) + acesso a dados
    time.ts               fuso horário (datas locais "YYYY-MM-DD", minutos, Intl)
    availability.ts       cálculo de horários livres
    pricing.ts            soma de preço/duração e promoções
    finance.ts            resumos financeiros
    policy.ts             regras de cancelamento/reagendamento da cliente
    booking.ts            criação de agendamento (servidor)
    data/                 consultas (public = cache da vitrine; admin = sessão + RLS)
    supabase/             clientes: server (sessão), admin (chave secreta), public (anônimo)
supabase/migrations       SQL versionado (fonte da verdade do banco)
supabase/seed.sql         dados de TESTE (só desenvolvimento local)
tests/db                  testes de banco com PGlite
```

## Decisões técnicas importantes

1. **Conflito de horário garantido pelo banco.** `appointments` tem uma restrição `EXCLUDE USING gist` (profissional + intervalo) para status ativos, e `book_appointment`/`reschedule_appointment` usam `pg_advisory_xact_lock` por profissional. Duas reservas simultâneas nunca passam juntas. Não remova nem contorne isso.
2. **Preço e duração vêm do banco.** O navegador envia só IDs de serviços e o horário. `book_appointment` recusa preço acima do cheio ou desconto sem promoção vigente.
3. **Expediente e bloqueios**: o horário escolhido é revalidado no servidor (`isSlotAvailable`) e bloqueios são checados de novo dentro da transação. Mudar o expediente **não** cancela reservas existentes.
4. **Link da cliente = token aleatório de 256 bits.** Só o hash SHA-256 fica no banco (`manage_token_hash`). Telefone ou nome nunca dão acesso a agendamentos. Páginas com token: `no-referrer`, `noindex`, `no-store`.
5. **Financeiro imutável.** Pagamentos e despesas não são editados nem apagados: são estornados (`voided_at` + motivo). Trigger `protect_financial_row` garante. "Recebido" = pagamentos não estornados; "previsto" = valor dos atendimentos. Pendências nunca contam como recebido.
6. **Auditoria automática** por trigger (`audit_row`) nas tabelas importantes; o ator vem de `auth.uid()` ou de `app.actor_id` (RPCs chamadas pelo servidor).
7. **Cache Components**: a vitrine (`lib/data/public.ts`) usa `"use cache"` + `cacheTag("catalog")`; toda alteração no painel que afeta o site chama `updateTag(CATALOG_TAG)`. Páginas do painel leem sessão dentro de `<Suspense>` (ver `admin/(painel)/layout.tsx`) e chamam `await connection()` antes de usar a data atual.
8. **Fuso horário**: padrão `America/Fortaleza` (configurável em `settings.timezone`). Nunca use `new Date().getHours()` para regra de negócio — use `utcToZoned`/`zonedToUtc`.
9. **Conteúdo do site** tem rascunho (`site_content_draft`, só admin) e versão publicada (`site_content`, pública). Pré-visualização em `/admin/previa`.
10. **WhatsApp** preparado e desativado: o banco só enfileira em `notification_outbox` quando `settings.whatsapp_notifications_enabled = true`, e o envio só ocorre com provedor configurado por variável de ambiente.

## Regras de segurança (obrigatórias)

- Toda Server Action do painel começa com `await requireAdmin()`. Toda página do painel fica dentro do `Gate` do layout.
- Leituras/escritas do painel usam `createSessionClient()` (RLS ativo). `createServiceClient()` (chave secreta, ignora RLS) só em: agendamento público, RPCs transacionais e limite de requisições — sempre **depois** de validar token/sessão.
- Nunca importe `lib/supabase/admin.ts` em componente cliente; arquivos de servidor têm `import "server-only"`.
- Toda entrada externa passa por Zod (ou parser dedicado) no servidor. Mensagens de erro em português, sem detalhes internos.
- RLS: tudo fechado por padrão (`security.sql`). Público lê só vitrine (serviços ativos, promoções, galeria, avaliações publicadas, conteúdo publicado). Funções de agenda executáveis só por `service_role`.
- Novas tabelas: habilitar RLS, revogar de `anon`/`authenticated`, criar políticas explícitas e (se relevante) trigger de auditoria — em **nova migration**, nunca editando migration já aplicada.
- Métricas são anônimas: sem IP, sem cookies, respeitando DNT/GPC. Caminhos com token são truncados.
- Limites de abuso: `rateLimit(escopo, máx, janela)` (tabela `rate_limits`) em login, agendamento, consulta de horários e links de cliente.

## Padrões de código

- Valores monetários em **centavos** (`integer`); formate com `formatBRL`. Entrada de valores com `parseBRL`.
- Telefones guardados só com dígitos e DDI (`5586999999999`); normalize com `normalizePhone`.
- Lógica de negócio em funções puras em `src/lib/*.ts` com testes em `src/lib/*.test.ts`.
- Mudança de banco = nova migration em `supabase/migrations/` + teste em `tests/db/`.
- Componentes cliente só quando há interação; estado de carregamento derivado (`useAsync`), sem `setState` síncrono em efeitos (regra de lint do React).
- Interface: mobile-first, alvos ≥ 44 px, inputs ≥ 16 px (iOS), foco visível, textos em linguagem simples e ativa.

## Identidade visual

Design system **Velvet Atelier** (referências do Stitch): rosewood `#81424b`/`#9e5a63` (ação principal), rosé empoeirado `#c28285`, pétala `#feb7ba`/`#ffd9dc`, champagne `#f7ebe1`, fundo `#fff8f7`, texto `#231918`/`#524344`. Tokens em `src/app/globals.css` (os nomes antigos — `rose-deep`, `blush`, `shell`… — foram mantidos e apontam para a nova paleta). Títulos em **Playfair Display**, interface em **Plus Jakarta Sans**. Padrões: cartões brancos `rounded-2xl` com `shadow-soft` (sombra rosé, sem contorno), botões `rounded-xl` com 48 px de altura, rótulos `.label-caps`, chips em pílula, brilho ambiente `.glow` atrás do topo. No título principal, `*palavra*` vira itálico rosewood (`RichTitle`).

Regra: as referências trazem conteúdo de exemplo (nomes, avaliações, endereço, serviços, selos); use apenas o estilo e a estrutura — **nunca dados fictícios**. Arquivos de marca em `public/brand/` (gerados por `scripts/brand-assets.mjs` a partir de `assets/brand/logo-original.jpeg`).
