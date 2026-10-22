"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSettings, loadAgendaState } from "@/lib/data/agenda";
import { findByToken } from "@/lib/data/manage";
import { isSlotAvailable } from "@/lib/availability";
import { dbErrorMessage } from "@/lib/errors";
import { canClientCancel, canClientReschedule } from "@/lib/policy";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/time";

export type ManageState = { ok: boolean; error?: string; message?: string } | null;

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export async function cancelByToken(token: string, _prev: ManageState, form: FormData): Promise<ManageState> {
  if (!tokenSchema.safeParse(token).success) return { ok: false, error: "Link inválido." };
  if (!(await rateLimit("manage", 20, 600))) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const appt = await findByToken(token);
  if (!appt || appt.status !== "confirmed") return { ok: false, error: "Este agendamento não pode mais ser cancelado." };

  const settings = await getSettings();
  const decision = canClientCancel(settings, appt.startsAt, new Date());
  if (!decision.allowed) return { ok: false, error: decision.reason };

  const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
  const { error } = await createServiceClient().rpc("cancel_appointment", {
    p_appointment_id: appt.id,
    p_reason: reason ? `Cliente: ${reason}` : "Cancelado pela cliente",
    p_actor: null,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/meu-agendamento/${token}`);
  return { ok: true, message: "Agendamento cancelado." };
}

export async function rescheduleByToken(token: string, startsAtIso: string): Promise<ManageState> {
  if (!tokenSchema.safeParse(token).success) return { ok: false, error: "Link inválido." };
  const parsed = z.iso.datetime().safeParse(startsAtIso);
  if (!parsed.success) return { ok: false, error: "Escolha um horário." };
  if (!(await rateLimit("manage", 20, 600))) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const appt = await findByToken(token);
  if (!appt || appt.status !== "confirmed") return { ok: false, error: "Este agendamento não pode mais ser alterado." };

  const settings = await getSettings();
  const now = new Date();
  const decision = canClientReschedule(settings, appt.startsAt, now);
  if (!decision.allowed) return { ok: false, error: decision.reason };

  const startsAt = new Date(parsed.data);
  const duration = Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000);
  const date = utcToZoned(startsAt, settings.tz).date;
  const state = await loadAgendaState(zonedToUtc(date, 0, settings.tz), zonedToUtc(addDays(date, 1), 0, settings.tz), {
    excludeAppointmentId: appt.id,
  });
  if (!isSlotAvailable(startsAt, date, duration, settings, state, now)) {
    return { ok: false, error: "Esse horário não está mais livre. Escolha outro." };
  }

  const { error } = await createServiceClient().rpc("reschedule_appointment", {
    p_appointment_id: appt.id,
    p_starts_at: startsAt.toISOString(),
    p_actor: null,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/meu-agendamento/${token}`);
  return { ok: true, message: "Horário alterado." };
}
