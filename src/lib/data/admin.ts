import "server-only";
import { createSessionClient } from "../supabase/server";
import { mapSettings } from "./agenda";

/**
 * Leituras do painel. Usam a sessão da administradora: o RLS do banco
 * garante que só administradoras recebem dados.
 */

export type AdminAppointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  source: "online" | "admin";
  totalCents: number;
  listTotalCents: number;
  notes: string;
  cancelReason: string | null;
  client: { id: string; name: string; phone: string };
  items: { serviceId: string; name: string; priceCents: number; listPriceCents: number; durationMinutes: number }[];
  paidCents: number;
};

const APPOINTMENT_SELECT =
  "id, starts_at, ends_at, status, source, total_cents, list_total_cents, notes, cancel_reason, clients(id, name, phone), appointment_items(service_id, service_name, price_cents, list_price_cents, duration_minutes), payments(amount_cents, voided_at)";

type Row = Record<string, unknown>;

function mapAppointment(r: Row): AdminAppointment {
  const client = r.clients as { id: string; name: string; phone: string };
  const items = (r.appointment_items ?? []) as Row[];
  const payments = (r.payments ?? []) as { amount_cents: number; voided_at: string | null }[];
  return {
    id: r.id as string,
    startsAt: new Date(r.starts_at as string),
    endsAt: new Date(r.ends_at as string),
    status: r.status as AdminAppointment["status"],
    source: r.source as AdminAppointment["source"],
    totalCents: r.total_cents as number,
    listTotalCents: r.list_total_cents as number,
    notes: (r.notes as string) ?? "",
    cancelReason: (r.cancel_reason as string) ?? null,
    client,
    items: items.map((i) => ({
      serviceId: i.service_id as string,
      name: i.service_name as string,
      priceCents: i.price_cents as number,
      listPriceCents: i.list_price_cents as number,
      durationMinutes: i.duration_minutes as number,
    })),
    paidCents: payments.filter((p) => !p.voided_at).reduce((s, p) => s + p.amount_cents, 0),
  };
}

export async function listAppointments(from: Date, to: Date, opts: { includeCancelled?: boolean } = {}) {
  const db = await createSessionClient();
  let query = db
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");
  if (!opts.includeCancelled) query = query.neq("status", "cancelled");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapAppointment);
}

export async function getAppointment(id: string) {
  const db = await createSessionClient();
  const { data, error } = await db.from("appointments").select(APPOINTMENT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapAppointment(data) : null;
}

export async function listAppointmentPayments(appointmentId: string) {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("payments")
    .select("id, amount_cents, paid_at, notes, voided_at, void_reason, payment_methods(name)")
    .eq("appointment_id", appointmentId)
    .order("paid_at");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    amountCents: p.amount_cents as number,
    paidAt: new Date(p.paid_at),
    notes: p.notes as string,
    voidedAt: p.voided_at ? new Date(p.voided_at) : null,
    voidReason: p.void_reason as string | null,
    method: (p.payment_methods as unknown as { name: string } | null)?.name ?? "",
  }));
}

/** Atendimentos realizados com saldo a receber. */
export async function listPendingPayments() {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("status", "completed")
    .order("starts_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []).map(mapAppointment).filter((a) => a.paidCents < a.totalCents);
}

/** Atendimentos confirmados que já passaram e ainda não foram marcados como realizados. */
export async function listToClose(now: Date) {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("status", "confirmed")
    .lt("ends_at", now.toISOString())
    .order("starts_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapAppointment);
}

export async function listClients(search: string) {
  const db = await createSessionClient();
  let query = db.from("clients").select("id, name, phone, created_at").is("anonymized_at", null).order("name").limit(100);
  const term = search.trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const safe = term.replace(/[%_,()"\\*:]/g, " ");
    query = digits.length >= 3 ? query.or(`name.ilike.%${safe}%,phone.like.%${digits}%`) : query.ilike("name", `%${safe}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; phone: string }[];
}

export async function getClient(id: string) {
  const db = await createSessionClient();
  const [client, appts, payments] = await Promise.all([
    db.from("clients").select("id, name, phone, notes, created_at, privacy_accepted_at, anonymized_at").eq("id", id).maybeSingle(),
    db.from("appointments").select(APPOINTMENT_SELECT).eq("client_id", id).order("starts_at", { ascending: false }).limit(200),
    // Só pagamentos avulsos: os ligados a atendimentos já entram em appointment.paidCents
    db.from("payments").select("amount_cents, voided_at").eq("client_id", id).is("appointment_id", null),
  ]);
  if (client.error) throw client.error;
  if (appts.error) throw appts.error;
  if (!client.data) return null;
  const appointments = (appts.data ?? []).map(mapAppointment);
  const loosePaid = (payments.data ?? []).filter((p) => !p.voided_at).reduce((s, p) => s + p.amount_cents, 0);
  return {
    ...(client.data as { id: string; name: string; phone: string; notes: string; created_at: string; anonymized_at: string | null }),
    appointments,
    totalPaidCents: appointments.reduce((s, a) => s + a.paidCents, 0) + loosePaid,
  };
}

export async function listServices() {
  const db = await createSessionClient();
  const [services, categories, combos] = await Promise.all([
    db.from("services").select("*").order("sort").order("name"),
    db.from("service_categories").select("id, name, sort").order("sort"),
    db.from("combo_items").select("combo_id, service_id"),
  ]);
  if (services.error) throw services.error;
  return {
    services: (services.data ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      slug: s.slug as string,
      description: s.description as string,
      priceCents: s.price_cents as number,
      durationMinutes: s.duration_minutes as number,
      active: s.active as boolean,
      featured: s.featured as boolean,
      isCombo: s.is_combo as boolean,
      sort: s.sort as number,
      categoryId: s.category_id as string | null,
      comboServiceIds: (combos.data ?? []).filter((c) => c.combo_id === s.id).map((c) => c.service_id as string),
    })),
    categories: (categories.data ?? []) as { id: string; name: string; sort: number }[],
  };
}

export async function listPromotions() {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("promotions")
    .select("id, title, description, promo_price_cents, starts_on, ends_on, active, promotion_services(service_id)")
    .order("ends_on", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    title: p.title as string,
    description: p.description as string,
    promoPriceCents: p.promo_price_cents as number,
    startsOn: p.starts_on as string,
    endsOn: p.ends_on as string,
    active: p.active as boolean,
    serviceIds: ((p.promotion_services ?? []) as { service_id: string }[]).map((x) => x.service_id),
  }));
}

export async function listPaymentMethods(includeInactive = false) {
  const db = await createSessionClient();
  let query = db.from("payment_methods").select("id, name, active, sort").order("sort").order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; active: boolean; sort: number }[];
}

export async function getAdminSettings() {
  const db = await createSessionClient();
  const { data, error } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return mapSettings(data);
}

export async function getScheduleConfig() {
  const db = await createSessionClient();
  const [hours, exceptions] = await Promise.all([
    db.from("business_hours").select("id, weekday, opens_at, closes_at").order("weekday").order("opens_at"),
    db.from("schedule_exceptions").select("id, on_date, opens_at, closes_at, note").gte("on_date", new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)).order("on_date").order("opens_at"),
  ]);
  if (hours.error) throw hours.error;
  if (exceptions.error) throw exceptions.error;
  return {
    hours: (hours.data ?? []).map((h) => ({ id: h.id as string, weekday: h.weekday as number, opensAt: (h.opens_at as string).slice(0, 5), closesAt: (h.closes_at as string).slice(0, 5) })),
    exceptions: (exceptions.data ?? []).map((e) => ({ id: e.id as string, onDate: e.on_date as string, opensAt: (e.opens_at as string).slice(0, 5), closesAt: (e.closes_at as string).slice(0, 5), note: e.note as string })),
  };
}

export async function listBlocks(from: Date, to?: Date) {
  const db = await createSessionClient();
  let query = db.from("time_blocks").select("id, kind, starts_at, ends_at, reason").gt("ends_at", from.toISOString()).order("starts_at");
  if (to) query = query.lt("starts_at", to.toISOString());
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id as string,
    kind: b.kind as "block" | "break" | "day_off" | "holiday" | "vacation",
    startsAt: new Date(b.starts_at),
    endsAt: new Date(b.ends_at),
    reason: b.reason as string,
  }));
}

export const BLOCK_KIND_LABEL = {
  block: "Bloqueio",
  break: "Intervalo",
  day_off: "Folga",
  holiday: "Feriado",
  vacation: "Férias",
} as const;

/** Dados brutos de um período para o resumo financeiro (ver lib/finance.ts). */
export async function loadFinance(fromUtc: Date, toUtc: Date, fromDate: string, toDate: string) {
  const db = await createSessionClient();
  const [appts, payments, expenses] = await Promise.all([
    db
      .from("appointments")
      .select("id, status, total_cents, appointment_items(service_id, service_name, price_cents)")
      .gte("starts_at", fromUtc.toISOString())
      .lt("starts_at", toUtc.toISOString()),
    db
      .from("payments")
      .select("id, amount_cents, paid_at, appointment_id, voided_at, payment_methods(name), clients(name)")
      .gte("paid_at", fromUtc.toISOString())
      .lt("paid_at", toUtc.toISOString())
      .order("paid_at", { ascending: false }),
    db.from("expenses").select("amount_cents, voided_at").gte("spent_on", fromDate).lt("spent_on", toDate),
  ]);
  for (const r of [appts, payments, expenses]) if (r.error) throw r.error;
  return {
    appointments: (appts.data ?? []).map((a) => ({
      id: a.id as string,
      status: a.status as "confirmed" | "completed" | "cancelled" | "no_show",
      totalCents: a.total_cents as number,
      items: ((a.appointment_items ?? []) as Row[]).map((i) => ({ serviceId: i.service_id as string, name: i.service_name as string, priceCents: i.price_cents as number })),
    })),
    payments: (payments.data ?? []).map((p) => ({
      id: p.id as string,
      amountCents: p.amount_cents as number,
      paidAt: new Date(p.paid_at),
      appointmentId: p.appointment_id as string | null,
      voided: Boolean(p.voided_at),
      methodName: (p.payment_methods as unknown as { name: string } | null)?.name ?? "—",
      clientName: (p.clients as unknown as { name: string } | null)?.name ?? "",
    })),
    expenses: (expenses.data ?? []).map((e) => ({ amountCents: e.amount_cents as number, voided: Boolean(e.voided_at) })),
  };
}

export async function listExpenses(fromDate: string, toDate: string) {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("expenses")
    .select("id, description, category, amount_cents, spent_on, voided_at, void_reason, payment_methods(name)")
    .gte("spent_on", fromDate)
    .lt("spent_on", toDate)
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id as string,
    description: e.description as string,
    category: e.category as string,
    amountCents: e.amount_cents as number,
    spentOn: e.spent_on as string,
    voided: Boolean(e.voided_at),
    voidReason: e.void_reason as string | null,
    method: (e.payment_methods as unknown as { name: string } | null)?.name ?? "",
  }));
}
