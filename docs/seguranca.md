# Segurança, LGPD e backups

## Controles implementados

| Área | Como |
| --- | --- |
| Autenticação do painel | Supabase Auth (e-mail e senha), sessão em cookies httpOnly renovada pelo `proxy.ts`. Login com limite de tentativas e mensagem única para erro. |
| Autorização | `requireAdmin()` valida a sessão no servidor (`auth.getUser`) e exige registro em `public.admins` em toda página e Server Action. O banco aplica o mesmo critério via RLS (`is_admin()`). |
| RLS | Habilitado em todas as tabelas; nada é acessível por padrão. Público lê só a vitrine. Clientes, agenda, financeiro, rascunhos e auditoria: somente administradoras. |
| Agendamento público | Não acessa o banco pelo navegador. Passa por Server Action → validação Zod → revalidação de horário → RPC transacional com a chave secreta. |
| Concorrência | Restrição `EXCLUDE` no banco + trava transacional por profissional. Testado com reservas simultâneas. |
| Links de clientes | Token aleatório de 256 bits; só o hash fica salvo; páginas `noindex`, `no-referrer`, `no-store`. Telefone nunca dá acesso. Admin pode gerar novo link (invalida o anterior). |
| Abuso | Limite por visitante (hash de IP com sal, sem guardar IP) em agendamento, consulta de horários, links e login. Campo-isca contra robôs no formulário. |
| Dados financeiros | Sem edição/exclusão: estorno com motivo. Trigger impede alterações. |
| Auditoria | Trigger registra criação/alteração/exclusão em agendamentos, pagamentos, despesas, serviços, promoções, regras, conteúdo publicado, horários, bloqueios e clientes. |
| Cabeçalhos | HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Painel e links com `noindex`. |
| Segredos | Chave secreta só em código com `import "server-only"`. Nada sensível em `NEXT_PUBLIC_*`. |
| Uploads | Somente admin (política do Storage), tipos de imagem permitidos, limite de 5 MB, foto reduzida no aparelho antes do envio. |

## LGPD

- **Dados coletados**: nome e WhatsApp da cliente; histórico de atendimentos e pagamentos. Nada além do necessário.
- **Base legal/transparência**: política em `/privacidade`; aceite registrado em `clients.privacy_accepted_at` no agendamento online.
- **Métricas** anônimas, sem cookies, respeitando "Não rastrear" e Global Privacy Control — dispensa banner de cookies.
- **Direitos do titular**: na ficha da cliente, "Remover dados pessoais (LGPD)" anonimiza nome, telefone e observações, e limpa as cópias na auditoria, mantendo o histórico financeiro sem identificação.
- **Acesso** aos dados: apenas administradoras autenticadas.
- **Operadores**: Supabase (banco/armazenamento) e Vercel (hospedagem). Registre-os no seu inventário de dados.

## Backups e restauração

- **Automático**: projetos Supabase pagos têm backup diário (Pro: 7 dias; com *Point-in-Time Recovery* opcional). No plano gratuito **não há backup automático** — faça o manual abaixo ao menos semanalmente.
- **Manual (lógico)**:

```bash
npx supabase db dump --linked -f backup/schema.sql
npx supabase db dump --linked --data-only -f backup/dados-$(date +%F).sql
```

  Guarde os arquivos fora do computador (ex.: drive com acesso restrito) — eles contêm dados pessoais.
- **Fotos**: o bucket `gallery` pode ser baixado pelo painel do Supabase (Storage) ou pela CLI.
- **Restauração**: em um projeto novo, aplique as migrations (`supabase db push`) e depois:

```bash
psql "$DATABASE_URL" -f backup/dados-AAAA-MM-DD.sql
```

  Teste a restauração periodicamente em um projeto separado.

## Revisão recomendada antes de abrir ao público

- Desativar cadastro público no Supabase Auth (ver `configuracao.md`).
- Senha forte para a administradora e, se possível, MFA no Supabase.
- Conferir que `SUPABASE_SECRET_KEY` está só no servidor (Vercel › *Sensitive*).
