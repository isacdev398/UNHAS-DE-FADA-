import "server-only";
import { z } from "zod";
import { computeAvailableDates, computeDaySlots, isSlotAvailable } from "./availability";
import { DEFAULT_PROFESSIONAL_ID, getSettings, loadAgendaState, type Settings } from "./data/agenda";
import { promotionsValidOn, quote, type ActivePromotion, type PricedService, type Quote } from "./pricing";
import { createServiceClient } from "./supabase/admin";
import { addDays, todayIn, utcToZoned, zonedToUtc } from "./time";
import { generateManageToken, hashToken } from "./tokens";

export const serviceIdsSchema = z.array(z.uuid()).min(1).max(10);

/** Serviços ativos e promoções vigentes, lidos direto do banco (nunca do navegador). */
async function loadPricing(serviceIds: string[]) {
  const db = createServiceClient();
  const [services, promotions] = await Promise.all([
    db.from("services").select("id, name, price_cents, duration_minutes").in("id", serviceIds).eq("active", true),
    db
      .from("promotions")
      .select("id, title, promo_price_cents, starts_on, ends_on, promotion_services(service_id)")
      .eq("active", true),
  ]);
  if (services.error) throw services.error;
  if (promotions.error) throw promotions.error;
  if ((services.data ?? []).length !== new Set(serviceIds).size) return null;

  const priced: PricedService[] = serviceIds
    .map((id) => services.data!.find((s) => s.id === id))
    .filter((s) => s !== undefined)
    .map((s) => ({ id: s.id, name: s.name, priceCents: s.price_cents, durationMinutes: s.duration_minutes }));
  const promos: ActivePromotion[] = (promotions.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    promoPriceCents: p.promo_price_cents,
    startsOn: p.starts_on,
    endsOn: p.ends_on,
    serviceIds: ((p.promotion_services ?? []) as { service_id: string }[]).map((x) => x.service_id),
  }));
  return { priced, promos };
}

export async function quoteFor(serviceIds: string[], date: string): Promise<Quote | null> {
  const pricing = await loadPricing(serviceIds);
  if (!pricing) return null;
  return quote(pricing.priced, promotionsValidOn(pricing.promos, date));
}

export async function availableDates(durationMinutes: number, now: Date, settings?: Settings) {
  const s = settings ?? (await getSettings());
  const today = todayIn(s.tz, now);
  const state = await loadAgendaState(zonedToUtc(today, 0, s.tz), zonedToUtc(addDays(today, s.maxAdvanceDays + 1), 0, s.tz));
  return computeAvailableDates(durationMinutes, s, state, now);
}

export async function availableSlots(
  durationMinutes: number,
  date: string,
  now: Date,
  opts: { excludeAppointmentId?: string; ignoreLimits?: boolean } = {},
) {
  const s = await getSettings();
  const state = await loadAgendaState(zonedToUtc(date, 0, s.tz), zonedToUtc(addDays(date, 1), 0, s.tz), opts);
  return computeDaySlots(date, durationMinutes, s, state, now, { ignoreLimits: opts.ignoreLimits }).map((d) =>
    d.toISOString(),
  );
}

export type BookingRequest = {
  serviceIds: string[];
  startsAt: Date;
  client: { id: string } | { name: string; phone: string };
  source: "online" | "admin";
  notes?: string;
  actorId?: string;
  /** Só a administradora: encaixe fora do expediente (ainda sem sobreposição). */
  allowOutsideHours?: boolean;
};

export type BookingResult =
  | { ok: true; appointmentId: string; token: string; quote: Quote }
  | { ok: false; reason: "slot" | "services" | "error"; error?: unknown };

export async function createBooking(req: BookingRequest, now = new Date()): Promise<BookingResult> {
  const settings = await getSettings();
  const local = utcToZoned(req.startsAt, settings.tz);

  const q = await quoteFor(req.serviceIds, local.date);
  if (!q) return { ok: false, reason: "services" };

  if (!req.allowOutsideHours) {
    const state = await loadAgendaState(
      zonedToUtc(local.date, 0, settings.tz),
      zonedToUtc(addDays(local.date, 1), 0, settings.tz),
    );
    const rules = req.source === "admin" ? { ...settings, minAdvanceMinutes: 0, maxAdvanceDays: 365 } : settings;
    if (!isSlotAvailable(req.startsAt, local.date, q.durationMinutes, rules, state, now)) {
      return { ok: false, reason: "slot" };
    }
  }

  const token = generateManageToken();
  const { data, error } = await createServiceClient().rpc("book_appointment", {
    p_professional_id: DEFAULT_PROFESSIONAL_ID,
    p_starts_at: req.startsAt.toISOString(),
    p_items: q.items.map((i) => ({ service_id: i.serviceId, price_cents: i.priceCents, promotion_id: i.promotionId })),
    p_client_id: "id" in req.client ? req.client.id : null,
    p_client_name: "name" in req.client ? req.client.name : null,
    p_client_phone: "phone" in req.client ? req.client.phone : null,
    p_source: req.source,
    p_token_hash: hashToken(token),
    p_notes: req.notes ?? "",
    p_actor: req.actorId ?? null,
  });
  if (error) {
    const msg = String(error.message);
    if (msg.includes("SLOT_UNAVAILABLE")) return { ok: false, reason: "slot", error };
    if (msg.includes("SERVICE_UNAVAILABLE") || msg.includes("INVALID_PRICE")) return { ok: false, reason: "services", error };
    return { ok: false, reason: "error", error };
  }
  return { ok: true, appointmentId: data as string, token, quote: q };
}

/** Novo link de gerenciamento (o anterior deixa de funcionar). */
export async function rotateManageToken(appointmentId: string) {
  const token = generateManageToken();
  const { error } = await createServiceClient()
    .from("appointments")
    .update({ manage_token_hash: hashToken(token) })
    .eq("id", appointmentId);
  if (error) throw error;
  return token;
}
