"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { availableSlots, createBooking, quoteFor, rotateManageToken, serviceIdsSchema } from "@/lib/booking";
import { getSettings, loadAgendaState } from "@/lib/data/agenda";
import { isSlotAvailable } from "@/lib/availability";
import { dbErrorMessage, type ActionResult } from "@/lib/errors";
import { normalizePhone, parseBRL } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { addDays, timeToMinutes, zonedToUtc } from "@/lib/time";
import { siteUrl } from "@/lib/env";

const dateSchema = z.iso.date();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

async function localToUtc(date: string, time: string) {
  const settings = await getSettings();
  return zonedToUtc(date, timeToMinutes(time), settings.tz);
}

// ---------------------------------------------------------------------------
// Consulta de horários livres e clientes (formulário de novo agendamento)
// ---------------------------------------------------------------------------

export async function freeSlotsAction(serviceIds: string[], date: string, excludeAppointmentId?: string) {
  await requireAdmin();
  const ids = serviceIdsSchema.safeParse(serviceIds);
  if (!ids.success || !dateSchema.safeParse(date).success) return { slots: [] as string[], durationMinutes: 0 };
  const q = await quoteFor(ids.data, date);
  if (!q) return { slots: [], durationMinutes: 0 };
  const slots = await availableSlots(q.durationMinutes, date, new Date(), { ignoreLimits: true, excludeAppointmentId });
  return { slots, durationMinutes: q.durationMinutes, totalCents: q.totalCents };
}

export async function rescheduleSlotsAction(appointmentId: string, date: string) {
  await requireAdmin();
  if (!dateSchema.safeParse(date).success) return [];
  const { data } = await (await createSessionClient()).from("appointments").select("starts_at, ends_at").eq("id", appointmentId).maybeSingle();
  if (!data) return [];
  const duration = Math.round((new Date(data.ends_at).getTime() - new Date(data.starts_at).getTime()) / 60_000);
  return availableSlots(duration, date, new Date(), { ignoreLimits: true, excludeAppointmentId: appointmentId });
}

export async function searchClientsAction(term: string) {
  await requireAdmin();
  const t = term.trim().slice(0, 60);
  if (t.length < 2) return [];
  const db = await createSessionClient();
  const digits = t.replace(/\D/g, "");
  const safe = t.replace(/[%_,()"\\*:]/g, " ");
  const query = db.from("clients").select("id, name, phone").is("anonymized_at", null).order("name").limit(8);
  const { data } = digits.length >= 3 ? await query.or(`name.ilike.%${safe}%,phone.like.%${digits}%`) : await query.ilike("name", `%${safe}%`);
  return (data ?? []) as { id: string; name: string; phone: string }[];
}

// ---------------------------------------------------------------------------
// Novo agendamento manual
// ---------------------------------------------------------------------------

const createSchema = z.object({
  serviceIds: serviceIdsSchema,
  date: dateSchema,
  time: timeSchema,
  clientId: z.uuid().optional(),
  clientName: z.string().trim().max(120).optional(),
  clientPhone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(1000).optional(),
  outsideHours: z.boolean().optional(),
});

export async function createAppointmentAction(input: z.input<typeof createSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha serviço, data e horário." };
  const d = parsed.data;

  let client: { id: string } | { name: string; phone: string };
  if (d.clientId) {
    client = { id: d.clientId };
  } else {
    const phone = d.clientPhone ? normalizePhone(d.clientPhone) : null;
    if (!d.clientName || d.clientName.length < 2) return { ok: false, error: "Informe o nome da cliente.", fieldErrors: { clientName: "Informe o nome." } };
    if (!phone) return { ok: false, error: "Confira o WhatsApp.", fieldErrors: { clientPhone: "WhatsApp com DDD." } };
    client = { name: d.clientName, phone };
  }

  const result = await createBooking({
    serviceIds: d.serviceIds,
    startsAt: await localToUtc(d.date, d.time),
    client,
    source: "admin",
    notes: d.notes,
    actorId: admin.id,
    allowOutsideHours: d.outsideHours,
  });
  if (!result.ok) {
    if (result.reason === "slot")
      return { ok: false, error: d.outsideHours ? "Já existe atendimento ou bloqueio nesse horário." : "Horário indisponível. Escolha um horário livre ou marque como encaixe." };
    return { ok: false, error: dbErrorMessage(result.error) };
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/agenda/${result.appointmentId}?link=${result.token}`);
}

// ---------------------------------------------------------------------------
// Ações sobre um agendamento
// ---------------------------------------------------------------------------

export async function setStatusAction(id: string, status: "completed" | "no_show" | "confirmed"): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Agendamento inválido." };
  const db = await createSessionClient();
  const { error } = await db.from("appointments").update({ status }).eq("id", id).neq("status", "cancelled");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: status === "completed" ? "Atendimento marcado como realizado." : "Status atualizado." };
}

export async function cancelAction(id: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const { error } = await createServiceClient().rpc("cancel_appointment", {
    p_appointment_id: id,
    p_reason: reason.trim().slice(0, 300) || "Cancelado pela profissional",
    p_actor: admin.id,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Agendamento cancelado. O horário está livre." };
}

export async function rescheduleAction(id: string, date: string, time: string, outsideHours: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!dateSchema.safeParse(date).success || !timeSchema.safeParse(time).success) return { ok: false, error: "Escolha data e horário." };
  const startsAt = await localToUtc(date, time);

  if (!outsideHours) {
    const settings = await getSettings();
    const { data } = await (await createSessionClient()).from("appointments").select("starts_at, ends_at").eq("id", id).maybeSingle();
    if (!data) return { ok: false, error: "Agendamento não encontrado." };
    const duration = Math.round((new Date(data.ends_at).getTime() - new Date(data.starts_at).getTime()) / 60_000);
    const state = await loadAgendaState(zonedToUtc(date, 0, settings.tz), zonedToUtc(addDays(date, 1), 0, settings.tz), { excludeAppointmentId: id });
    if (!isSlotAvailable(startsAt, date, duration, { ...settings, minAdvanceMinutes: 0, maxAdvanceDays: 365 }, state, new Date())) {
      return { ok: false, error: "Horário fora do expediente ou ocupado. Marque como encaixe se quiser mesmo assim." };
    }
  }
  const { error } = await createServiceClient().rpc("reschedule_appointment", { p_appointment_id: id, p_starts_at: startsAt.toISOString(), p_actor: admin.id });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Horário alterado." };
}

export async function updateNotesAction(id: string, notes: string): Promise<ActionResult> {
  await requireAdmin();
  const db = await createSessionClient();
  const { error } = await db.from("appointments").update({ notes: notes.trim().slice(0, 1000) }).eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/admin/agenda/${id}`);
  return { ok: true, message: "Observação salva." };
}

/** Gera um novo link de gerenciamento para enviar à cliente (o anterior deixa de valer). */
export async function shareLinkAction(id: string): Promise<ActionResult<{ url: string }>> {
  await requireAdmin();
  const token = await rotateManageToken(id);
  return { ok: true, data: { url: `${siteUrl()}/meu-agendamento/${token}` } };
}

// ---------------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------------

export async function recordPaymentAction(appointmentId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const amount = parseBRL(String(form.get("amount") ?? ""));
  const methodId = z.uuid().safeParse(form.get("methodId"));
  if (!amount || amount <= 0) return { ok: false, error: "Informe o valor recebido." };
  if (!methodId.success) return { ok: false, error: "Escolha a forma de pagamento." };

  const db = await createSessionClient();
  const { data: appt } = await db.from("appointments").select("client_id, status").eq("id", appointmentId).maybeSingle();
  if (!appt) return { ok: false, error: "Agendamento não encontrado." };

  const { error } = await db.from("payments").insert({
    appointment_id: appointmentId,
    client_id: appt.client_id,
    method_id: methodId.data,
    amount_cents: amount,
    notes: String(form.get("notes") ?? "").trim().slice(0, 300),
    created_by: admin.id,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  // Receber pagamento de um horário confirmado já marca como realizado.
  if (appt.status === "confirmed") await db.from("appointments").update({ status: "completed" }).eq("id", appointmentId);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Pagamento registrado." };
}

export async function voidPaymentAction(paymentId: string, reason: string): Promise<ActionResult> {
  await requireAdmin();
  const text = reason.trim();
  if (text.length < 3) return { ok: false, error: "Informe o motivo do estorno." };
  const db = await createSessionClient();
  const { error } = await db.from("payments").update({ voided_at: new Date().toISOString(), void_reason: text.slice(0, 300) }).eq("id", paymentId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Pagamento estornado." };
}

// ---------------------------------------------------------------------------
// Bloqueios (folgas, feriados, férias, intervalos)
// ---------------------------------------------------------------------------

const blockSchema = z.object({
  kind: z.enum(["block", "break", "day_off", "holiday", "vacation"]),
  startDate: dateSchema,
  endDate: dateSchema,
  allDay: z.boolean(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  reason: z.string().trim().max(200),
});

export async function createBlockAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = blockSchema.safeParse({
    kind: form.get("kind"),
    startDate: form.get("startDate"),
    endDate: form.get("endDate") || form.get("startDate"),
    allDay: form.get("allDay") === "on",
    startTime: form.get("startTime") || undefined,
    endTime: form.get("endTime") || undefined,
    reason: form.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Confira as datas e horários." };
  const b = parsed.data;
  const settings = await getSettings();
  const starts = zonedToUtc(b.startDate, b.allDay ? 0 : timeToMinutes(b.startTime ?? "00:00"), settings.tz);
  const ends = b.allDay
    ? zonedToUtc(addDays(b.endDate, 1), 0, settings.tz)
    : zonedToUtc(b.endDate, timeToMinutes(b.endTime ?? "23:59"), settings.tz);
  if (ends <= starts) return { ok: false, error: "O fim precisa ser depois do início." };

  const db = await createSessionClient();
  // Avisa (sem cancelar) se já existem atendimentos no período.
  const { count } = await db
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .lt("starts_at", ends.toISOString())
    .gt("ends_at", starts.toISOString());

  const { error } = await db.from("time_blocks").insert({
    professional_id: "00000000-0000-4000-8000-000000000001",
    kind: b.kind,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    reason: b.reason,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: count
      ? `Bloqueio salvo. Atenção: há ${count} atendimento(s) confirmado(s) nesse período — eles continuam marcados.`
      : "Bloqueio salvo.",
  };
}

export async function deleteBlockAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await (await createSessionClient()).from("time_blocks").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Bloqueio removido." };
}
