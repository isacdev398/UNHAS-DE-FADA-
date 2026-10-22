# Unhas de Fada

Site e sistema de agendamento da **Unhas de Fada — manicure**.

- **Site público**: apresentação da marca, tabela de preços, promoções, galeria, avaliações, contato e **agendamento online em 3 passos** (serviços → horário → nome e WhatsApp). Sem cadastro, sem senha, sem aplicativo.
- **Link da cliente**: cada agendamento gera um link seguro para consultar, reagendar ou cancelar, conforme as regras definidas pela profissional.
- **Painel** (`/admin`), pensado para o celular: Início, Agenda (dia/semana/mês, bloqueios, folgas, férias, horários especiais), Clientes (histórico, valores pagos), Financeiro (recebido × previsto, despesas, pendências, comparativos), Serviços (preços, combos, promoções) e Configurações (textos do site com pré-visualização, galeria, avaliações, formas de pagamento, métricas, auditoria).

## Começando

Pré-requisitos: Node.js 20+ e um projeto no [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev
```

Sem as variáveis do Supabase o site abre com a tabela de preços oficial, mas o agendamento e o painel ficam indisponíveis (aparece um aviso).

Configuração completa do banco, primeira administradora e e-mails: **[docs/configuracao.md](docs/configuracao.md)**.
Publicação na Vercel: **[docs/deploy.md](docs/deploy.md)**.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run typecheck` | Tipos de rota + TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Todos os testes (domínio + banco) |
| `npm run test:db` | Testes de banco: migrations, RLS, conflitos e reservas simultâneas |
| `npm run check` | typecheck + lint + testes |
| `node scripts/brand-assets.mjs` | Regera logo transparente, ícones e imagem de compartilhamento |

## Testes

Os testes de banco rodam as migrations reais em um Postgres embutido (PGlite), sem Docker. Cobrem:

- criação de agendamento com preço e duração vindos do banco;
- conflito de horários e **reservas simultâneas** (só uma vence);
- promoções válidas/expiradas e tentativa de preço adulterado;
- bloqueios, folgas e férias;
- cancelamento e reagendamento;
- integridade financeira (valores imutáveis, estorno com motivo) e auditoria;
- LGPD (anonimização preservando o histórico);
- **RLS**: visitante e usuária não-admin não acessam clientes, agenda nem financeiro.

Os testes de domínio cobrem fuso horário, cálculo de horários livres, preços/promoções, regras de cancelamento, resumos financeiros, telefone e tokens.

## Documentação

- [CLAUDE.md](CLAUDE.md) — arquitetura, decisões e regras para quem for desenvolver.
- [docs/configuracao.md](docs/configuracao.md) — Supabase, primeira administradora, e-mails, backups.
- [docs/deploy.md](docs/deploy.md) — publicação na Vercel.
- [docs/seguranca.md](docs/seguranca.md) — segurança, LGPD, backups e restauração.
- [docs/whatsapp.md](docs/whatsapp.md) — integração futura de WhatsApp (desativada).
- [docs/pendencias.md](docs/pendencias.md) — o que depende de informação ou serviço externo.
