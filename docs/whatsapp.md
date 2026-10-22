# WhatsApp automático (preparado, desativado)

O sistema funciona normalmente sem integração. Hoje, em cada agendamento do painel, os botões **Enviar confirmação** e **Enviar lembrete** abrem o WhatsApp da profissional com a mensagem pronta (gratuito, via `wa.me`).

## Como a integração foi preparada

1. **Fila no banco** — `notification_outbox`. As funções `book_appointment`, `reschedule_appointment` e `cancel_appointment` chamam `enqueue_notifications`, que só grava algo quando `settings.whatsapp_notifications_enabled = true`:
   - confirmação (imediata), lembrete 24 h antes, cancelamento, reagendamento;
   - lembretes antigos são descartados quando o horário muda ou é cancelado.
2. **Entrega** — `src/lib/notifications.ts` (`processOutbox`) envia as pendentes por um `WhatsAppProvider`, com até 3 tentativas. Exposto em `GET /api/cron/notificacoes` (exige `Authorization: Bearer CRON_SECRET`).
3. **Interruptor** — Painel › Configurações › Mensagens automáticas. Só liga se houver provedor configurado.

## Para ativar (quando decidir contratar)

1. Contrate um provedor. Implementado: **WhatsApp Cloud API (Meta)**. Mensagens iniciadas pela empresa fora da janela de 24 h exigem *templates* aprovados e são cobradas por conversa — avalie custos antes.
2. Configure na Vercel: `WHATSAPP_PROVIDER=meta-cloud`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `CRON_SECRET`.
3. Crie o cron (ver `deploy.md`, passo 5).
4. Ative no painel.

Para outro provedor (Twilio, Z-API etc.), implemente a interface `WhatsAppProvider` em `src/lib/notifications.ts` e selecione-o em `getWhatsAppProvider()`.
