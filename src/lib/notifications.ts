import "server-only";
import { createServiceClient } from "./supabase/admin";
import { formatDateTime } from "./time";
import { siteUrl } from "./env";

/**
 * Integração com WhatsApp — preparada, mas DESATIVADA por padrão.
 *
 * Fluxo: as funções do banco enfileiram mensagens em notification_outbox
 * (somente quando settings.whatsapp_notifications_enabled = true). Um cron
 * chama /api/cron/notificacoes, que entrega as pendentes pelo provedor.
 *
 * Nenhum serviço pago é contratado ou chamado sem configuração explícita
 * (WHATSAPP_PROVIDER + credenciais). Veja docs/whatsapp.md.
 */

export type OutboxKind = "confirmation" | "reminder_24h" | "cancellation" | "reschedule";

export type WhatsAppMessage = { to: string; text: string };

export interface WhatsAppProvider {
  name: string;
  send(message: WhatsAppMessage): Promise<void>;
}

/** WhatsApp Cloud API (Meta). Só é usada se as variáveis estiverem definidas. */
class MetaCloudProvider implements WhatsAppProvider {
  name = "meta-cloud";
  constructor(
    private token: string,
    private phoneNumberId: string,
  ) {}
  async send({ to, text }: WhatsAppMessage) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

export function getWhatsAppProvider(): WhatsAppProvider | null {
  if (process.env.WHATSAPP_PROVIDER === "meta-cloud" && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return new MetaCloudProvider(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_PHONE_NUMBER_ID);
  }
  return null;
}

export function isWhatsAppProviderConfigured() {
  return getWhatsAppProvider() !== null;
}

export function messageFor(kind: OutboxKind, data: { name: string; startsAt: Date; services: string; tz: string }) {
  const first = data.name.split(" ")[0];
  const when = formatDateTime(data.startsAt, data.tz);
  switch (kind) {
    case "confirmation":
      return `Oi, ${first}! Seu horário no Unhas de Fada está confirmado: ${when} (${data.services}).`;
    case "reminder_24h":
      return `Oi, ${first}! Lembrete: amanhã você tem horário no Unhas de Fada, ${when} (${data.services}). Te esperamos!`;
    case "cancellation":
      return `Oi, ${first}. Seu horário de ${when} no Unhas de Fada foi cancelado. Para remarcar: ${siteUrl()}/agendar`;
    case "reschedule":
      return `Oi, ${first}! Seu horário no Unhas de Fada foi alterado para ${when} (${data.services}).`;
  }
}

/** Entrega as mensagens pendentes. Sem provedor configurado, não faz nada. */
export async function processOutbox(limit = 25) {
  const provider = getWhatsAppProvider();
  if (!provider) return { sent: 0, failed: 0, skipped: true };
  const db = createServiceClient();
  const { data: settings } = await db.from("settings").select("timezone, whatsapp_notifications_enabled").eq("id", 1).single();
  if (!settings?.whatsapp_notifications_enabled) return { sent: 0, failed: 0, skipped: true };

  const { data: rows } = await db
    .from("notification_outbox")
    .select("id, kind, attempts, appointments(starts_at, status, clients(name, phone), appointment_items(service_name))")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for")
    .limit(limit);

  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const appt = row.appointments as unknown as {
      starts_at: string;
      status: string;
      clients: { name: string; phone: string };
      appointment_items: { service_name: string }[];
    };
    // Lembrete de horário cancelado não é enviado.
    if (row.kind === "reminder_24h" && appt.status !== "confirmed") {
      await db.from("notification_outbox").update({ status: "skipped" }).eq("id", row.id);
      continue;
    }
    try {
      await provider.send({
        to: appt.clients.phone,
        text: messageFor(row.kind as OutboxKind, {
          name: appt.clients.name,
          startsAt: new Date(appt.starts_at),
          services: appt.appointment_items.map((i) => i.service_name).join(" + "),
          tz: settings.timezone,
        }),
      });
      await db.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1 }).eq("id", row.id);
      sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      await db
        .from("notification_outbox")
        .update({ status: attempts >= 3 ? "failed" : "pending", attempts, last_error: String(e).slice(0, 300) })
        .eq("id", row.id);
      failed++;
    }
  }
  return { sent, failed, skipped: false };
}
