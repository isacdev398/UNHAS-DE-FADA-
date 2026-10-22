-- Unhas de Fada — dados iniciais reais (tabela de preços e contatos da marca)
-- Durações e horários de funcionamento são valores iniciais: ajuste no painel.

insert into professionals (id, name) values ('00000000-0000-4000-8000-000000000001', 'Unhas de Fada');

insert into settings (id) values (1);

insert into site_content (id, published, published_at)
values (1, jsonb_build_object(
  'heroTitle', 'Unhas bem cuidadas, do jeitinho que você gosta',
  'heroSubtitle', 'Manicure e pedicure com carinho, capricho e horário marcado. Escolha o serviço e veja os horários livres em segundos.',
  'aboutTitle', 'Sobre o atendimento',
  'about', 'Cada atendimento é feito com calma e atenção aos detalhes, em um espaço pensado para você relaxar enquanto cuida das suas unhas.',
  'whatsapp', '5586994598467',
  'instagram', '',
  'address', 'Rua Francisco Brito Souza, 5039 – Vila Bandeirante',
  'city', '',
  'mapsUrl', '',
  'hoursNote', '',
  'heroImagePath', '',
  'aboutImagePath', ''
), now());

insert into site_content_draft (id, draft) select 1, published from site_content where id = 1;

insert into service_categories (id, name, sort) values
  ('00000000-0000-4000-8000-0000000000c1', 'Manicure', 1),
  ('00000000-0000-4000-8000-0000000000c2', 'Pedicure', 2),
  ('00000000-0000-4000-8000-0000000000c3', 'Combos', 3);

insert into services (id, category_id, name, slug, description, price_cents, duration_minutes, featured, is_combo, sort) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'Mão', 'mao',
   'Manicure completa: cutilagem, lixa e esmaltação.', 2000, 45, true, false, 1),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000c2', 'Pé', 'pe',
   'Pedicure completa: cutilagem, lixa e esmaltação.', 2000, 50, true, false, 2),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000c3', 'Mão e Pé', 'mao-e-pe',
   'Manicure e pedicure no mesmo horário.', 4000, 90, true, true, 3);

insert into combo_items (combo_id, service_id) values
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a2');

insert into payment_methods (name, sort) values
  ('Dinheiro', 1), ('Pix', 2), ('Cartão de débito', 3), ('Cartão de crédito', 4);

-- Terça a sábado, 08:00–12:00 e 13:30–18:00 (ajuste no painel em Agenda › Horários)
insert into business_hours (professional_id, weekday, opens_at, closes_at)
select '00000000-0000-4000-8000-000000000001', d, t.opens, t.closes
  from generate_series(2, 6) as d
  cross join (values (time '08:00', time '12:00'), (time '13:30', time '18:00')) as t(opens, closes);
