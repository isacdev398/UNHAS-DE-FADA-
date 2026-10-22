# Pendências externas

Itens que dependem de informação, conta ou decisão da marca. O sistema já funciona sem eles.

| Pendência | Onde resolver | Situação atual |
| --- | --- | --- |
| Projeto Supabase e chaves | `docs/configuracao.md` | Sem banco, o site mostra a tabela de preços, mas o agendamento e o painel ficam indisponíveis. |
| Primeira administradora | `docs/configuracao.md`, passo 3 | — |
| Deploy na Vercel e domínio | `docs/deploy.md` | Nenhum deploy foi feito. |
| **Duração real de cada serviço** | Painel › Serviços | Valores iniciais: Mão 45 min, Pé 50 min, Mão e Pé 1 h 30 min. |
| **Dias e horários de atendimento** | Painel › Configurações › Horários de atendimento | Valores iniciais: terça a sábado, 08:00–12:00 e 13:30–18:00. |
| Instagram, cidade e link do mapa | Painel › Configurações › Textos, contatos e foto de capa | Endereço e WhatsApp já preenchidos com os dados da tabela de preços; Instagram e cidade em branco (ocultos no site). |
| Fotos reais dos trabalhos | Painel › Configurações › Galeria | A galeria só aparece no site quando houver fotos. Nenhuma foto de exemplo foi usada. |
| Avaliações reais | Painel › Configurações › Avaliações | Seção oculta até haver avaliações autorizadas. |
| Descrições dos serviços | Painel › Serviços | Textos curtos iniciais; ajuste à sua forma de trabalhar. |
| SMTP próprio para e-mails de senha | Supabase › Authentication › SMTP | Envio padrão do Supabase (limitado). |
| Backup automático | Plano pago do Supabase | Ver `docs/seguranca.md` (backup manual). |
| WhatsApp automático | `docs/whatsapp.md` | Desativado; envio manual por botões no painel. |
