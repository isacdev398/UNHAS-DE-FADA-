import { connection } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";

const eventSchema = z.object({
  kind: z.enum(["page_view", "booking_start", "booking_complete"]),
  path: z.string().startsWith("/").max(200),
  source: z
    .string()
    .max(60)
    .regex(/^[\w.\-]+$/)
    .nullable()
    .optional(),
});

/** Métricas anônimas de conversão. Nada de IP, cookie ou identificador é salvo. */
export async function POST(request: Request) {
  await connection();
  if (!isSupabaseConfigured()) return new Response(null, { status: 204 });
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  if (!(await rateLimit("track", 60, 60))) return new Response(null, { status: 429 });

  // Links de gerenciamento contêm o token: nunca registrar o caminho completo.
  const path = parsed.data.path.startsWith("/meu-agendamento") ? "/meu-agendamento" : parsed.data.path.split("?")[0];
  await createServiceClient()
    .from("analytics_events")
    .insert({ kind: parsed.data.kind, path, source: parsed.data.source?.toLowerCase() ?? null });
  return new Response(null, { status: 204 });
}
