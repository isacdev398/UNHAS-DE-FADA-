-- Unhas de Fada — Row Level Security e permissões
-- Regra geral: tudo fechado por padrão. O público lê apenas o conteúdo da vitrine.
-- Dados de clientes, agenda e financeiro: somente administradoras autenticadas.
-- Agendamento online passa pelo servidor (service_role), nunca direto do navegador.

do $$
declare t text;
begin
  foreach t in array array[
    'admins', 'professionals', 'settings', 'site_content', 'site_content_draft',
    'service_categories', 'services', 'combo_items', 'promotions', 'promotion_services',
    'clients', 'business_hours', 'schedule_exceptions', 'time_blocks', 'appointments',
    'appointment_items', 'payment_methods', 'payments', 'expenses', 'gallery_photos',
    'testimonials', 'analytics_events', 'notification_outbox', 'rate_limits', 'audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
  end loop;
end $$;

-- Funções: ninguém executa por padrão.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function is_admin() to anon, authenticated;
grant execute on function current_actor() to anon, authenticated;

-- Funções de operação: somente o servidor (service_role), após validar a sessão.
grant execute on function book_appointment(uuid, timestamptz, jsonb, uuid, text, text, appointment_source, text, text, uuid) to service_role;
grant execute on function reschedule_appointment(uuid, timestamptz, uuid) to service_role;
grant execute on function cancel_appointment(uuid, text, uuid) to service_role;
grant execute on function anonymize_client(uuid, uuid) to service_role;
grant execute on function hit_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Leitura pública (vitrine)
-- ---------------------------------------------------------------------------
grant select on service_categories, services, combo_items, promotions, promotion_services,
  gallery_photos, testimonials, site_content, settings to anon, authenticated;

create policy public_read on service_categories for select to anon, authenticated using (true);
create policy public_read on services for select to anon, authenticated using (active or is_admin());
create policy public_read on combo_items for select to anon, authenticated using (true);
create policy public_read on promotions for select to anon, authenticated
  using ((active and ends_on >= (now() at time zone 'America/Fortaleza')::date - 1) or is_admin());
create policy public_read on promotion_services for select to anon, authenticated using (true);
create policy public_read on gallery_photos for select to anon, authenticated using (true);
create policy public_read on testimonials for select to anon, authenticated using (published or is_admin());
create policy public_read on site_content for select to anon, authenticated using (true);
create policy public_read on settings for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Administração (usuárias em public.admins)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on service_categories, services, combo_items, promotions,
  promotion_services, gallery_photos, testimonials, business_hours, schedule_exceptions,
  time_blocks, payment_methods to authenticated;
grant select, insert, update on clients, payments, expenses to authenticated;
grant select, update on appointments, settings, site_content, site_content_draft to authenticated;
grant select on appointment_items, professionals, admins, audit_log, analytics_events,
  notification_outbox to authenticated;

create policy admin_all on service_categories for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on services for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on combo_items for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on promotions for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on promotion_services for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on gallery_photos for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on testimonials for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on business_hours for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on schedule_exceptions for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on time_blocks for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on payment_methods for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on clients for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on payments for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on expenses for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on appointments for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on settings for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on site_content for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on site_content_draft for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_read on appointment_items for select to authenticated using (is_admin());
create policy admin_read on professionals for select to authenticated using (is_admin());
create policy admin_read on admins for select to authenticated using (is_admin());
create policy admin_read on audit_log for select to authenticated using (is_admin());
create policy admin_read on analytics_events for select to authenticated using (is_admin());
create policy admin_read on notification_outbox for select to authenticated using (is_admin());
-- rate_limits: sem políticas (somente service_role).
