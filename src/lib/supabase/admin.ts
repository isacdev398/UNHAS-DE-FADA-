import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "../env";

let client: SupabaseClient | null = null;

/**
 * Cliente com a chave secreta (ignora RLS). Uso restrito ao servidor, para:
 * - agendamento online (a visitante não tem acesso direto ao banco);
 * - RPCs transacionais de agenda, sempre depois de validar a sessão/token.
 * Nunca importe este arquivo em componentes de cliente.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl() || !key) {
    throw new Error("Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");
  }
  client ??= createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
