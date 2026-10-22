# Publicação na Vercel

> Nenhum deploy de produção foi feito automaticamente. Os passos abaixo devem ser executados pela responsável pelo projeto.

## 1. Repositório

Envie o projeto para um repositório Git (GitHub, GitLab ou Bitbucket). Arquivos `.env*` estão no `.gitignore` (exceto `.env.example`).

## 2. Projeto na Vercel

1. <https://vercel.com/new> › importe o repositório. Framework: **Next.js** (detectado).
2. **Environment Variables** (Production e Preview):

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publicável |
| `SUPABASE_SECRET_KEY` | chave secreta (marque como *Sensitive*) |
| `NEXT_PUBLIC_SITE_URL` | domínio final, ex.: `https://unhasdefada.com.br` |
| `RATE_LIMIT_SALT` | texto aleatório longo |
| `CRON_SECRET` | texto aleatório longo (só necessário quando o WhatsApp for ativado) |

Gere textos aleatórios com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

3. **Deploy**. O build precisa das variáveis do Supabase, pois as páginas públicas são pré-renderizadas com os dados do banco.

## 3. Domínio

**Settings › Domains**: adicione o domínio e siga as instruções de DNS. Atualize `NEXT_PUBLIC_SITE_URL` e as URLs de autenticação do Supabase (ver `configuracao.md`, passo 4).

## 4. Depois do deploy

- Acesse `/admin/entrar` e faça login.
- Faça um agendamento de teste pelo site no celular e cancele-o pelo link recebido.
- No Instagram, coloque na bio: `https://SEU-DOMINIO/agendar?utm_source=instagram-bio`.
  Para um serviço específico: `https://SEU-DOMINIO/agendar?servico=mao-e-pe` (o link de cada serviço aparece na tela de edição do serviço).

## 5. Tarefa agendada (só quando o WhatsApp for ativado)

Crie `vercel.json` na raiz:

```json
{ "crons": [{ "path": "/api/cron/notificacoes", "schedule": "*/15 * * * *" }] }
```

A Vercel envia automaticamente `Authorization: Bearer CRON_SECRET`. Atenção: no plano Hobby, crons rodam no máximo uma vez por dia — lembretes de 24 h exigem o plano Pro ou um agendador externo chamando a mesma rota com o cabeçalho.
