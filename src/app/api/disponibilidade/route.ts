import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { availableDates, availableSlots, quoteFor, serviceIdsSchema } from "@/lib/booking";
import { getSettings } from "@/lib/data/agenda";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/time";
import { hashToken, isWellFormedToken } from "@/lib/tokens";

const querySchema = z.object({
  servicos: z.string().max(400).optional(),
  data: z.iso.date().optional(),
  token: z.string().max(64).optional(),
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Horários livres. Responde apenas datas e horários — nunca dados de agendamentos.
 * - ?servicos=id,id            → datas com horário livre
 * - ?servicos=id,id&data=AAAA-MM-DD → horários do dia
 * - ?token=...                 → reagendamento (usa a duração do agendamento e ignora o próprio horário)
 */
export async function GET(request: NextRequest) {
  await connection();
  if (!isSupabaseConfigured()) return json({ error: "Agendamento online ainda não configurado." }, 503);
  if (!(await rateLimit("availability", 120, 60))) return json({ error: "Muitas consultas. Aguarde um minuto." }, 429);

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return json({ error: "Consulta inválida." }, 400);
  const { servicos, data, token } = parsed.data;
  const now = new Date();

  let durationMinutes: number;
  let excludeAppointmentId: string | undefined;

  if (token) {
    if (!isWellFormedToken(token)) return json({ error: "Link inválido." }, 404);
    const { data: appt } = await createServiceClient()
      .from("appointments")
      .select("id, starts_at, ends_at, status")
      .eq("manage_token_hash", hashToken(token))
      .maybeSingle();
    if (!appt || appt.status !== "confirmed") return json({ error: "Agendamento não encontrado." }, 404);
    durationMinutes = Math.round((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60_000);
    excludeAppointmentId = appt.id;
  } else {
    const ids = serviceIdsSchema.safeParse(servicos?.split(",").filter(Boolean));
    if (!ids.success) return json({ error: "Escolha pelo menos um serviço." }, 400);
    const settings = await getSettings();
    const q = await quoteFor(ids.data, data ?? todayIn(settings.tz, now));
    if (!q) return json({ error: "Um dos serviços não está mais disponível." }, 409);
    durationMinutes = q.durationMinutes;
    if (!data) {
      return json({ durationMinutes, dates: await availableDates(durationMinutes, now, settings) });
    }
  }

  if (!data) {
    return json({ durationMinutes, dates: await availableDates(durationMinutes, now) });
  }
  return json({ durationMinutes, slots: await availableSlots(durationMinutes, data, now, { excludeAppointmentId }) });
}
