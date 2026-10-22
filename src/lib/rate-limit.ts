import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "./supabase/admin";

/** Identificador anônimo do visitante (hash do IP com sal); o IP nunca é salvo. */
export async function visitorKey() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const salt = process.env.RATE_LIMIT_SALT ?? "unhas-de-fada";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Limite de tentativas por janela de tempo, guardado no banco (funciona em
 * várias instâncias serverless). Em caso de falha do banco, permite.
 */
export async function rateLimit(scope: string, max: number, windowSeconds: number) {
  const key = `${scope}:${await visitorKey()}`;
  const { data, error } = await createServiceClient().rpc("hit_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data === true;
}
