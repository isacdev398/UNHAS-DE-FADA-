# Configuração

## 1. Criar o projeto no Supabase

1. Crie um projeto em <https://supabase.com/dashboard> (região **South America (São Paulo)**).
2. Em **Project Settings › API**, copie:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (ou *anon key*) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (ou *service_role key*) → `SUPABASE_SECRET_KEY` (**nunca** exponha no navegador)

## 2. Aplicar as migrations

Opção A — Supabase CLI (recomendado):

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Opção B — SQL Editor: execute, **em ordem**, os arquivos de `supabase/migrations/`.

As migrations criam o esquema, as funções transacionais, o RLS, o bucket `gallery` do Storage e os **dados iniciais reais** (tabela de preços Mão R$ 20, Pé R$ 20, Mão e Pé R$ 40, WhatsApp e endereço).

> `supabase/seed.sql` contém **dados de teste** e só roda em ambiente local (`npx supabase db reset`). Não execute em produção.

## 3. Criar a primeira administradora

1. **Authentication › Users › Add user › Create new user**: informe e-mail e uma senha forte (≥ 10 caracteres) e marque *Auto Confirm User*.
2. No **SQL Editor**, autorize essa usuária no painel:

```sql
insert into public.admins (user_id, name)
select id, 'Nome da Profissional' from auth.users where email = 'email@exemplo.com';
```

Só usuárias presentes em `public.admins` entram no painel; qualquer outra conta é recusada no login e bloqueada pelo RLS.

3. **Authentication › Sign In / Providers**: desative *Allow new users to sign up* (ninguém deve criar conta sozinho).

## 4. E-mail de recuperação de senha

Em **Authentication › URL Configuration**:

- *Site URL*: o endereço do site (ex.: `https://unhasdefada.com.br`)
- *Redirect URLs*: `https://unhasdefada.com.br/admin/auth/confirm`

Em **Authentication › Email Templates › Reset Password**, troque o link por:

```html
<a href="{{ .SiteURL }}/admin/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/admin/nova-senha">Criar nova senha</a>
```

Para produção, configure um SMTP próprio em **Authentication › Emails › SMTP Settings** (o envio padrão do Supabase tem limite baixo).

## 5. Revisar no painel

Depois de entrar em `/admin`:

1. **Configurações › Horários de atendimento**: confira os dias e horários de atendimento. Os valores iniciais (terça a sábado, 08:00–12:00 e 13:30–18:00) são apenas um ponto de partida.
2. **Serviços**: confira a **duração** de cada serviço (iniciais: Mão 45 min, Pé 50 min, Mão e Pé 1 h 30 min).
3. **Configurações › Textos, contatos e foto de capa**: preencha Instagram, cidade e link do mapa; publique.
4. **Configurações › Galeria**: envie fotos reais dos trabalhos.

## 6. Ambiente local

```bash
cp .env.example .env.local
npm run dev
```

Para um banco local completo (opcional, requer Docker): `npx supabase start` e use as chaves exibidas.
