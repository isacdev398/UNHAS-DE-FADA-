import "server-only";
import type { AgendaState, ScheduleRules } from "../availability";
import type { ClientPolicy } from "../policy";
import { DEFAULT_TZ } from "../time";
import { createServiceClient } from "../supabase/admin";

export const DEFAULT_PROFESSIONAL_ID = "00000000-0000-4000-8000-000000000001";

export type Settings = ScheduleRules &
  ClientPolicy & {
    whatsappNotificationsEnabled: boolean;
  };

export const DEFAULT_SETTINGS: Settings = {
  tz: DEFAULT_TZ,
  intervalMinutes: 15,
  bufferMinutes: 0,
  minAdvanceMinutes: 120,
  maxAdvanceDays: 60,
  allowClientCancel: true,
  cancelMinHours: 12,
  allowClientReschedule: true,
  rescheduleMinHours: 12,
  whatsappNotificationsEnabled: false,
};

export function mapSettings(row: Record<string, unknown> | null): Settings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    tz: row.timezone as string,
    intervalMinutes: row.slot_interval_minutes as number,
    bufferMinutes: row.buffer_minutes as number,
    minAdvanceMinutes: row.min_advance_minutes as number,
    maxAdvanceDays: row.max_advance_days as number,
    allowClientCancel: row.allow_client_cancel as boolean,
    cancelMinHours: row.cancel_min_hours as number,
    allowClientReschedule: row.allow_client_reschedule as boolean,
    rescheduleMinHours: row.reschedule_min_hours as number,
    whatsappNotificationsEnabled: row.whatsapp_notifications_enabled as boolean,
  };
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await createServiceClient().from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return mapSettings(data);
}

/**
 * Estado da agenda entre dois instantes: horários, exceções, bloqueios e
 * ocupação. Retorna apenas intervalos de tempo, nunca dados de clientes.
 */
export async function loadAgendaState(
  from: Date,
  to: Date,
  opts: { excludeAppointmentId?: string; professionalId?: string } = {},
): Promise<AgendaState> {
  const professionalId = opts.professionalId ?? DEFAULT_PROFESSIONAL_ID;
  const db = createServiceClient();
  const fromDate = new Date(from.getTime() - 86_400_000).toISOString().slice(0, 10);
  const toDate = new Date(to.getTime() + 86_400_000).toISOString().slice(0, 10);

  let busyQuery = db
    .from("appointments")
    .select("id, starts_at, ends_at")
    .eq("professional_id", professionalId)
    .in("status", ["confirmed", "completed"])
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString());
  if (opts.excludeAppointmentId) busyQuery = busyQuery.neq("id", opts.excludeAppointmentId);

  const [hours, exceptions, blocks, busy] = await Promise.all([
    db.from("business_hours").select("weekday, opens_at, closes_at").eq("professional_id", professionalId),
    db
      .from("schedule_exceptions")
      .select("on_date, opens_at, closes_at")
      .eq("professional_id", professionalId)
      .gte("on_date", fromDate)
      .lte("on_date", toDate),
    db
      .from("time_blocks")
      .select("starts_at, ends_at")
      .eq("professional_id", professionalId)
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString()),
    busyQuery,
  ]);
  for (const r of [hours, exceptions, blocks, busy]) if (r.error) throw r.error;

  return {
    weeklyHours: (hours.data ?? []).map((h) => ({ weekday: h.weekday, opensAt: h.opens_at, closesAt: h.closes_at })),
    exceptions: (exceptions.data ?? []).map((e) => ({ onDate: e.on_date, opensAt: e.opens_at, closesAt: e.closes_at })),
    blocks: (blocks.data ?? []).map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
    busy: (busy.data ?? []).map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
  };
}
