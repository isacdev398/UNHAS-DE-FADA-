-- Unhas de Fada — funções, auditoria e operações transacionais de agenda

-- ---------------------------------------------------------------------------
-- Autorização
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Ator da operação: usuário logado ou o informado pelo servidor nas RPCs.
create or replace function current_actor() returns uuid
language sql stable
as $$
  select coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid);
$$;

-- ---------------------------------------------------------------------------
-- Auditoria genérica
-- ---------------------------------------------------------------------------
create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into audit_log (actor, action, table_name, record_id, old_data, new_data)
  values (
    current_actor(),
    lower(tg_op),
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', null),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_appointments after insert or update or delete on appointments for each row execute function audit_row();
create trigger audit_payments after insert or update or delete on payments for each row execute function audit_row();
create trigger audit_expenses after insert or update or delete on expenses for each row execute function audit_row();
create trigger audit_services after insert or update or delete on services for each row execute function audit_row();
create trigger audit_promotions after insert or update or delete on promotions for each row execute function audit_row();
create trigger audit_settings after update on settings for each row execute function audit_row();
create trigger audit_site_content after update on site_content for each row execute function audit_row();
create trigger audit_business_hours after insert or update or delete on business_hours for each row execute function audit_row();
create trigger audit_time_blocks after insert or update or delete on time_blocks for each row execute function audit_row();
create trigger audit_clients after insert or update or delete on clients for each row execute function audit_row();

-- Pagamentos e despesas: valor, forma e data não mudam depois de lançados.
-- Para corrigir, estorne (voided_at + void_reason) e lance novamente.
create or replace function protect_financial_row() returns trigger
language plpgsql
as $$
begin
  if old.voided_at is not null then
    raise exception 'FINANCIAL_ROW_VOIDED' using errcode = 'P0001';
  end if;
  if tg_table_name = 'payments' then
    if new.amount_cents <> old.amount_cents or new.method_id <> old.method_id
       or new.paid_at <> old.paid_at or new.appointment_id is distinct from old.appointment_id then
      raise exception 'FINANCIAL_ROW_IMMUTABLE' using errcode = 'P0001';
    end if;
  else
    if new.amount_cents <> old.amount_cents or new.spent_on <> old.spent_on then
      raise exception 'FINANCIAL_ROW_IMMUTABLE' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger payments_protect before update on payments for each row execute function protect_financial_row();
create trigger expenses_protect before update on expenses for each row execute function protect_financial_row();

-- ---------------------------------------------------------------------------
-- Limite de requisições (janela fixa). Retorna true se a requisição é permitida.
-- ---------------------------------------------------------------------------
create or replace function hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

-- ---------------------------------------------------------------------------
-- Fila de notificações (só enfileira se a integração estiver ativada)
-- ---------------------------------------------------------------------------
create or replace function enqueue_notifications(p_appointment_id uuid, p_kind notification_kind)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_enabled boolean;
  v_starts timestamptz;
begin
  select whatsapp_notifications_enabled into v_enabled from settings where id = 1;
  if not coalesce(v_enabled, false) then
    return;
  end if;

  select starts_at into v_starts from appointments where id = p_appointment_id;

  -- Lembretes antigos deixam de valer quando o horário muda ou é cancelado.
  update notification_outbox set status = 'skipped'
   where appointment_id = p_appointment_id and kind = 'reminder_24h' and status = 'pending';

  insert into notification_outbox (appointment_id, kind) values (p_appointment_id, p_kind);

  if p_kind in ('confirmation', 'reschedule') and v_starts - interval '24 hours' > now() then
    insert into notification_outbox (appointment_id, kind, scheduled_for)
    values (p_appointment_id, 'reminder_24h', v_starts - interval '24 hours');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Verifica bloqueios de agenda no intervalo
-- ---------------------------------------------------------------------------
create or replace function assert_not_blocked(p_professional_id uuid, p_starts timestamptz, p_ends timestamptz)
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if exists (
    select 1 from time_blocks
     where professional_id = p_professional_id
       and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts, p_ends, '[)')
  ) then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Criação de agendamento (transação única)
-- p_items: [{ "service_id": uuid, "price_cents": int, "promotion_id": uuid|null }]
-- O preço cheio e a duração vêm sempre da tabela services.
-- ---------------------------------------------------------------------------
create or replace function book_appointment(
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_items jsonb,
  p_client_id uuid,
  p_client_name text,
  p_client_phone text,
  p_source appointment_source,
  p_token_hash text,
  p_notes text default '',
  p_actor uuid default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_client_id uuid;
  v_appointment_id uuid;
  v_duration integer;
  v_total integer;
  v_list_total integer;
  v_count integer;
  v_valid integer;
  v_tz text;
  v_local_date date;
begin
  perform set_config('app.actor_id', coalesce(p_actor::text, ''), true);

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'NO_ITEMS' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 10 then
    raise exception 'TOO_MANY_ITEMS' using errcode = 'P0001';
  end if;

  select timezone into v_tz from settings where id = 1;
  v_local_date := (p_starts_at at time zone coalesce(v_tz, 'America/Fortaleza'))::date;

  create temporary table if not exists _booking_items (
    ord integer, service_id uuid, service_name text, list_price_cents integer,
    price_cents integer, duration_minutes integer, promotion_id uuid
  ) on commit drop;
  truncate _booking_items;

  insert into _booking_items
  select i.ord::integer, s.id, s.name, s.price_cents,
         (i.item ->> 'price_cents')::integer, s.duration_minutes,
         nullif(i.item ->> 'promotion_id', '')::uuid
    from jsonb_array_elements(p_items) with ordinality as i(item, ord)
    join services s on s.id = (i.item ->> 'service_id')::uuid and s.active;

  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_items) then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Preço cobrado nunca acima do preço cheio; desconto só com promoção válida.
  select count(*) into v_valid from _booking_items b
   where b.price_cents >= 0 and b.price_cents <= b.list_price_cents
     and (
       (b.promotion_id is null and b.price_cents = b.list_price_cents)
       or exists (
         select 1 from promotions p
           join promotion_services ps on ps.promotion_id = p.id and ps.service_id = b.service_id
          where p.id = b.promotion_id and p.active
            and v_local_date between p.starts_on and p.ends_on
       )
     );
  if v_valid <> v_count then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
  end if;

  select sum(duration_minutes), sum(price_cents), sum(list_price_cents)
    into v_duration, v_total, v_list_total
    from _booking_items;

  -- Serializa reservas da mesma profissional: duas requisições simultâneas
  -- nunca passam juntas por esta seção. A restrição de exclusão é a garantia final.
  perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text, 0));

  perform assert_not_blocked(p_professional_id, p_starts_at, p_starts_at + make_interval(mins => v_duration));

  if p_client_id is not null then
    select id into v_client_id from clients where id = p_client_id and anonymized_at is null;
    if v_client_id is null then
      raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0001';
    end if;
  else
    if p_client_phone !~ '^[0-9]{10,15}$' or char_length(coalesce(trim(p_client_name), '')) = 0 then
      raise exception 'INVALID_CLIENT' using errcode = 'P0001';
    end if;
    -- Cliente existente mantém o nome cadastrado (ninguém altera dados de outra pessoa pelo site).
    insert into clients (name, phone, privacy_accepted_at)
    values (trim(p_client_name), p_client_phone, case when p_source = 'online' then now() end)
    on conflict (phone) do update set privacy_accepted_at = coalesce(clients.privacy_accepted_at, excluded.privacy_accepted_at)
    returning id into v_client_id;
  end if;

  begin
    insert into appointments (professional_id, client_id, starts_at, ends_at, status, source,
                              total_cents, list_total_cents, notes, manage_token_hash)
    values (p_professional_id, v_client_id, p_starts_at, p_starts_at + make_interval(mins => v_duration),
            'confirmed', p_source, v_total, v_list_total, coalesce(p_notes, ''), p_token_hash)
    returning id into v_appointment_id;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end;

  insert into appointment_items (appointment_id, service_id, service_name, list_price_cents,
                                 price_cents, duration_minutes, promotion_id)
  select v_appointment_id, service_id, service_name, list_price_cents, price_cents, duration_minutes, promotion_id
    from _booking_items order by ord;

  perform enqueue_notifications(v_appointment_id, 'confirmation');
  return v_appointment_id;
end $$;

-- ---------------------------------------------------------------------------
-- Reagendamento (mantém duração e itens)
-- ---------------------------------------------------------------------------
create or replace function reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_actor uuid default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_appt appointments%rowtype;
  v_ends timestamptz;
begin
  perform set_config('app.actor_id', coalesce(p_actor::text, ''), true);

  select * into v_appt from appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_appt.status <> 'confirmed' then
    raise exception 'APPOINTMENT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  v_ends := p_starts_at + (v_appt.ends_at - v_appt.starts_at);

  perform pg_advisory_xact_lock(hashtextextended(v_appt.professional_id::text, 0));
  perform assert_not_blocked(v_appt.professional_id, p_starts_at, v_ends);

  begin
    update appointments set starts_at = p_starts_at, ends_at = v_ends where id = p_appointment_id;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end;

  perform enqueue_notifications(p_appointment_id, 'reschedule');
end $$;

-- ---------------------------------------------------------------------------
-- Cancelamento
-- ---------------------------------------------------------------------------
create or replace function cancel_appointment(
  p_appointment_id uuid,
  p_reason text default null,
  p_actor uuid default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform set_config('app.actor_id', coalesce(p_actor::text, ''), true);

  update appointments
     set status = 'cancelled', cancelled_at = now(), cancel_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_appointment_id and status = 'confirmed';

  if not found then
    raise exception 'APPOINTMENT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  perform enqueue_notifications(p_appointment_id, 'cancellation');
end $$;

-- ---------------------------------------------------------------------------
-- LGPD: anonimização de cliente (mantém o histórico financeiro sem dados pessoais)
-- ---------------------------------------------------------------------------
create or replace function anonymize_client(p_client_id uuid, p_actor uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform set_config('app.actor_id', coalesce(p_actor::text, ''), true);

  if exists (select 1 from appointments where client_id = p_client_id and status = 'confirmed' and starts_at > now()) then
    raise exception 'CLIENT_HAS_FUTURE_APPOINTMENTS' using errcode = 'P0001';
  end if;

  update clients
     set name = 'Cliente removida',
         phone = lpad((('x' || substr(md5(id::text), 1, 12))::bit(48)::bigint % 1000000000000000)::text, 15, '0'),
         notes = '',
         anonymized_at = now()
   where id = p_client_id and anonymized_at is null;

  if not found then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Remove os dados pessoais também das cópias guardadas na auditoria.
  update audit_log set old_data = null, new_data = null
   where table_name = 'clients' and record_id = p_client_id::text;
end $$;
