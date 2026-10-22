"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_PROFESSIONAL_ID } from "@/lib/data/agenda";
import { CATALOG_TAG } from "@/lib/data/public";
import { dbErrorMessage, type ActionResult } from "@/lib/errors";
import { createSessionClient } from "@/lib/supabase/server";
import { timeToMinutes } from "@/lib/time";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const range = z.object({ opensAt: time, closesAt: time }).refine((r) => timeToMinutes(r.closesAt) > timeToMinutes(r.opensAt), {
  error: "O fim precisa ser depois do início.",
});

function noOverlap(ranges: { opensAt: string; closesAt: string }[]) {
  const sorted = [...ranges].sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  return sorted.every((r, i) => i === 0 || timeToMinutes(r.opensAt) >= timeToMinutes(sorted[i - 1].closesAt));
}

/**
 * Substitui os horários de funcionamento da semana. Não mexe em agendamentos
 * existentes: mudar o expediente nunca cancela reservas.
 */
export async function saveWeeklyHoursAction(input: { weekday: number; opensAt: string; closesAt: string }[]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(range.and(z.object({ weekday: z.number().int().min(0).max(6) }))).max(42).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os horários: o fim precisa ser depois do início." };
  for (let d = 0; d < 7; d++) {
    if (!noOverlap(parsed.data.filter((r) => r.weekday === d))) return { ok: false, error: "Há faixas de horário sobrepostas no mesmo dia." };
  }
  const db = await createSessionClient();
  const { error } = await db.rpc("replace_business_hours", { p_professional_id: DEFAULT_PROFESSIONAL_ID, p_hours: parsed.data });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/agenda/horarios");
  return { ok: true, message: "Horários salvos. Agendamentos já marcados continuam valendo." };
}

export async function addExceptionAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ onDate: z.iso.date(), note: z.string().trim().max(200) })
    .and(range)
    .safeParse({ onDate: form.get("onDate"), opensAt: form.get("opensAt"), closesAt: form.get("closesAt"), note: form.get("note") ?? "" });
  if (!parsed.success) return { ok: false, error: "Confira a data e os horários." };
  const { error } = await (await createSessionClient()).from("schedule_exceptions").insert({
    professional_id: DEFAULT_PROFESSIONAL_ID,
    on_date: parsed.data.onDate,
    opens_at: parsed.data.opensAt,
    closes_at: parsed.data.closesAt,
    note: parsed.data.note,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/agenda/horarios");
  return { ok: true, message: "Horário especial salvo. Nesse dia, valem só os horários especiais." };
}

export async function deleteExceptionAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await (await createSessionClient()).from("schedule_exceptions").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/agenda/horarios");
  return { ok: true };
}

const settingsSchema = z.object({
  slot_interval_minutes: z.coerce.number().int().refine((v) => [5, 10, 15, 20, 30, 60].includes(v)),
  buffer_minutes: z.coerce.number().int().min(0).max(120),
  min_advance_minutes: z.coerce.number().int().min(0).max(10080),
  max_advance_days: z.coerce.number().int().min(1).max(365),
  allow_client_cancel: z.boolean(),
  cancel_min_hours: z.coerce.number().int().min(0).max(336),
  allow_client_reschedule: z.boolean(),
  reschedule_min_hours: z.coerce.number().int().min(0).max(336),
});

export async function saveRulesAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse({
    slot_interval_minutes: form.get("slot_interval_minutes"),
    buffer_minutes: form.get("buffer_minutes"),
    min_advance_minutes: Number(form.get("min_advance_hours") ?? 0) * 60,
    max_advance_days: form.get("max_advance_days"),
    allow_client_cancel: form.get("allow_client_cancel") === "on",
    cancel_min_hours: form.get("cancel_min_hours"),
    allow_client_reschedule: form.get("allow_client_reschedule") === "on",
    reschedule_min_hours: form.get("reschedule_min_hours"),
  });
  if (!parsed.success) return { ok: false, error: "Confira os valores." };
  const { error } = await (await createSessionClient()).from("settings").update(parsed.data).eq("id", 1);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/agenda/horarios");
  return { ok: true, message: "Regras salvas." };
}
