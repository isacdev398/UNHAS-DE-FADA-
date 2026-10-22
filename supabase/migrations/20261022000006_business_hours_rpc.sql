-- Substitui os horários semanais em uma única transação (tudo ou nada).
-- security invoker: roda com as permissões e o RLS de quem chama (somente admin).
create or replace function replace_business_hours(p_professional_id uuid, p_hours jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  delete from business_hours where professional_id = p_professional_id;
  insert into business_hours (professional_id, weekday, opens_at, closes_at)
  select p_professional_id, (h ->> 'weekday')::smallint, (h ->> 'opensAt')::time, (h ->> 'closesAt')::time
    from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) as h;
end $$;

revoke execute on function replace_business_hours(uuid, jsonb) from public, anon;
grant execute on function replace_business_hours(uuid, jsonb) to authenticated;
