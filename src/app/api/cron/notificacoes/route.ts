import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { processOutbox } from "@/lib/notifications";
import { safeEqual } from "@/lib/tokens";

/**
 * Entrega da fila de WhatsApp. Chamado por um cron (Vercel Cron) com
 * Authorization: Bearer CRON_SECRET. Sem provedor configurado, não envia nada.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Não autorizado", { status: 401 });
  if (!isSupabaseConfigured()) return Response.json({ skipped: true });
  return Response.json(await processOutbox());
}
