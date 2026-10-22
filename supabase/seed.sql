-- DADOS DE TESTE — somente para desenvolvimento local (supabase db reset).
-- Nunca execute este arquivo no banco de produção.

insert into clients (id, name, phone) values
  ('00000000-0000-4000-8000-00000000d001', 'Cliente Teste Ana', '5586900000001'),
  ('00000000-0000-4000-8000-00000000d002', 'Cliente Teste Bia', '5586900000002');

insert into appointments (professional_id, client_id, starts_at, ends_at, status, source, total_cents, list_total_cents, manage_token_hash)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000d001',
   date_trunc('day', now() + interval '1 day') + interval '12 hours', date_trunc('day', now() + interval '1 day') + interval '12 hours 45 minutes',
   'confirmed', 'online', 2000, 2000, encode(digest('token-teste-1', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000d002',
   date_trunc('day', now() - interval '1 day') + interval '14 hours', date_trunc('day', now() - interval '1 day') + interval '15 hours 30 minutes',
   'completed', 'admin', 4000, 4000, encode(digest('token-teste-2', 'sha256'), 'hex'));

insert into appointment_items (appointment_id, service_id, service_name, list_price_cents, price_cents, duration_minutes)
select a.id, '00000000-0000-4000-8000-0000000000a1', 'Mão', 2000, 2000, 45
  from appointments a where a.manage_token_hash = encode(digest('token-teste-1', 'sha256'), 'hex');
insert into appointment_items (appointment_id, service_id, service_name, list_price_cents, price_cents, duration_minutes)
select a.id, '00000000-0000-4000-8000-0000000000a3', 'Mão e Pé', 4000, 4000, 90
  from appointments a where a.manage_token_hash = encode(digest('token-teste-2', 'sha256'), 'hex');
