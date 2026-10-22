-- Unhas de Fada — esquema principal
-- Valores monetários sempre em centavos (integer). Datas/horas em timestamptz (UTC).

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type appointment_status as enum ('confirmed', 'completed', 'cancelled', 'no_show');
create type appointment_source as enum ('online', 'admin');
create type block_kind as enum ('block', 'break', 'day_off', 'holiday', 'vacation');
create type analytics_event_kind as enum ('page_view', 'booking_start', 'booking_complete');
create type notification_kind as enum ('confirmation', 'reminder_24h', 'cancellation', 'reschedule');
create type notification_status as enum ('pending', 'sent', 'failed', 'skipped');

-- ---------------------------------------------------------------------------
-- Função utilitária para updated_at
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Administração
-- ---------------------------------------------------------------------------
create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

-- Profissionais: hoje uma só, mas toda a agenda já é separada por profissional.
create table professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Configurações (linha única, id = 1)
create table settings (
  id smallint primary key default 1 check (id = 1),
  timezone text not null default 'America/Fortaleza',
  slot_interval_minutes smallint not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  buffer_minutes smallint not null default 0 check (buffer_minutes between 0 and 120),
  min_advance_minutes integer not null default 120 check (min_advance_minutes between 0 and 10080),
  max_advance_days smallint not null default 60 check (max_advance_days between 1 and 365),
  allow_client_cancel boolean not null default true,
  cancel_min_hours smallint not null default 12 check (cancel_min_hours between 0 and 336),
  allow_client_reschedule boolean not null default true,
  reschedule_min_hours smallint not null default 12 check (reschedule_min_hours between 0 and 336),
  whatsapp_notifications_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on settings for each row execute function set_updated_at();

-- Conteúdo do site: versão publicada (pública) e rascunho (somente admin).
create table site_content (
  id smallint primary key default 1 check (id = 1),
  published jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger site_content_updated_at before update on site_content for each row execute function set_updated_at();

create table site_content_draft (
  id smallint primary key default 1 check (id = 1),
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger site_content_draft_updated_at before update on site_content_draft for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Serviços, combos e promoções
-- ---------------------------------------------------------------------------
create table service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  sort integer not null default 0
);

create table services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references service_categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 600),
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  active boolean not null default true,
  featured boolean not null default false,
  is_combo boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_active_idx on services (active, sort);
create trigger services_updated_at before update on services for each row execute function set_updated_at();

-- Serviços que compõem um combo (apenas informativo/vitrine).
create table combo_items (
  combo_id uuid not null references services (id) on delete cascade,
  service_id uuid not null references services (id) on delete restrict,
  primary key (combo_id, service_id),
  check (combo_id <> service_id)
);

create table promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 400),
  promo_price_cents integer not null check (promo_price_cents >= 0),
  starts_on date not null,
  ends_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index promotions_window_idx on promotions (active, starts_on, ends_on);
create trigger promotions_updated_at before update on promotions for each row execute function set_updated_at();

create table promotion_services (
  promotion_id uuid not null references promotions (id) on delete cascade,
  service_id uuid not null references services (id) on delete restrict,
  primary key (promotion_id, service_id)
);
create index promotion_services_service_idx on promotion_services (service_id);

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  -- Somente dígitos, com DDI (ex.: 5586994598467)
  phone text not null unique check (phone ~ '^[0-9]{10,15}$'),
  notes text not null default '' check (char_length(notes) <= 2000),
  privacy_accepted_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_name_idx on clients (lower(name));
create trigger clients_updated_at before update on clients for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------
-- Horários de funcionamento: várias faixas por dia (o intervalo é o espaço entre elas).
create table business_hours (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at)
);
create index business_hours_prof_idx on business_hours (professional_id, weekday);

-- Horários excepcionais para uma data específica (substituem os horários do dia).
create table schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  on_date date not null,
  opens_at time not null,
  closes_at time not null,
  note text not null default '' check (char_length(note) <= 200),
  check (closes_at > opens_at)
);
create index schedule_exceptions_idx on schedule_exceptions (professional_id, on_date);

-- Bloqueios: horários bloqueados, folgas, feriados e férias.
create table time_blocks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  kind block_kind not null default 'block',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index time_blocks_range_idx on time_blocks using gist (professional_id, tstzrange(starts_at, ends_at, '[)'));

create table appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete restrict,
  client_id uuid not null references clients (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'confirmed',
  source appointment_source not null,
  -- Valor previsto (já com descontos de promoções)
  total_cents integer not null check (total_cents >= 0),
  -- Soma dos preços cheios, para relatórios de desconto
  list_total_cents integer not null check (list_total_cents >= total_cents),
  notes text not null default '' check (char_length(notes) <= 1000),
  -- Hash SHA-256 (hex) do token do link de gerenciamento. O token em si nunca é salvo.
  manage_token_hash text not null unique check (manage_token_hash ~ '^[0-9a-f]{64}$'),
  cancelled_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  -- Impede, no próprio banco, dois atendimentos ativos sobrepostos para a mesma profissional.
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('confirmed', 'completed'))
);
create index appointments_starts_idx on appointments (starts_at);
create index appointments_client_idx on appointments (client_id, starts_at desc);
create trigger appointments_updated_at before update on appointments for each row execute function set_updated_at();

create table appointment_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  service_id uuid not null references services (id) on delete restrict,
  -- Cópias do momento da reserva: alterar o serviço depois não muda o histórico.
  service_name text not null,
  list_price_cents integer not null check (list_price_cents >= 0),
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  promotion_id uuid references promotions (id) on delete set null
);
create index appointment_items_appt_idx on appointment_items (appointment_id);
create index appointment_items_service_idx on appointment_items (service_id);

-- ---------------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------------
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40),
  active boolean not null default true,
  sort integer not null default 0
);

-- Pagamentos nunca são apagados: são estornados (voided_at) com motivo.
create table payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments (id) on delete restrict,
  client_id uuid references clients (id) on delete restrict,
  method_id uuid not null references payment_methods (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  paid_at timestamptz not null default now(),
  notes text not null default '' check (char_length(notes) <= 300),
  voided_at timestamptz,
  void_reason text check (char_length(void_reason) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check ((voided_at is null) = (void_reason is null))
);
create index payments_paid_at_idx on payments (paid_at) where voided_at is null;
create index payments_appt_idx on payments (appointment_id);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 1 and 120),
  category text not null default 'Geral' check (char_length(category) between 1 and 40),
  amount_cents integer not null check (amount_cents > 0),
  spent_on date not null,
  method_id uuid references payment_methods (id) on delete set null,
  voided_at timestamptz,
  void_reason text check (char_length(void_reason) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check ((voided_at is null) = (void_reason is null))
);
create index expenses_spent_on_idx on expenses (spent_on) where voided_at is null;

-- ---------------------------------------------------------------------------
-- Galeria e avaliações
-- ---------------------------------------------------------------------------
create table gallery_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  alt text not null default '' check (char_length(alt) <= 200),
  service_id uuid references services (id) on delete set null,
  featured boolean not null default false,
  sort integer not null default 0,
  width integer check (width > 0),
  height integer check (height > 0),
  created_at timestamptz not null default now()
);
create index gallery_photos_sort_idx on gallery_photos (featured desc, sort, created_at desc);

-- Avaliações reais, cadastradas pela administradora com autorização da cliente.
create table testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(author_name) between 1 and 60),
  body text not null check (char_length(body) between 1 and 600),
  rating smallint check (rating between 1 and 5),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Métricas (anônimas: sem IP, sem cookies, sem identificadores pessoais)
-- ---------------------------------------------------------------------------
create table analytics_events (
  id bigint generated always as identity primary key,
  kind analytics_event_kind not null,
  path text not null check (char_length(path) <= 200),
  source text check (char_length(source) <= 60),
  created_at timestamptz not null default now()
);
create index analytics_events_kind_idx on analytics_events (kind, created_at);

-- ---------------------------------------------------------------------------
-- WhatsApp (fila preparada; desativada por padrão)
-- ---------------------------------------------------------------------------
create table notification_outbox (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  kind notification_kind not null,
  channel text not null default 'whatsapp',
  status notification_status not null default 'pending',
  scheduled_for timestamptz not null default now(),
  attempts smallint not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_outbox_pending_idx on notification_outbox (status, scheduled_for);

-- ---------------------------------------------------------------------------
-- Limite de requisições (proteção contra abuso em ambiente serverless)
-- ---------------------------------------------------------------------------
create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
create table audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on audit_log (created_at desc);
create index audit_log_record_idx on audit_log (table_name, record_id);
