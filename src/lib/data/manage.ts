import "server-only";
import { createServiceClient } from "../supabase/admin";
import { hashToken, isWellFormedToken } from "../tokens";

export type ManagedAppointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  totalCents: number;
  clientFirstName: string;
  items: { name: string; priceCents: number; durationMinutes: number }[];
};

/** Busca o agendamento pelo token do link. Telefone ou nome nunca dão acesso. */
export async function findByToken(token: string): Promise<ManagedAppointment | null> {
  if (!isWellFormedToken(token)) return null;
  const { data, error } = await createServiceClient()
    .from("appointments")
    .select("id, starts_at, ends_at, status, total_cents, clients(name), appointment_items(service_name, price_cents, duration_minutes)")
    .eq("manage_token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const client = data.clients as unknown as { name: string } | null;
  return {
    id: data.id,
    startsAt: new Date(data.starts_at),
    endsAt: new Date(data.ends_at),
    status: data.status,
    totalCents: data.total_cents,
    clientFirstName: (client?.name ?? "").split(" ")[0],
    items: ((data.appointment_items ?? []) as { service_name: string; price_cents: number; duration_minutes: number }[]).map((i) => ({
      name: i.service_name,
      priceCents: i.price_cents,
      durationMinutes: i.duration_minutes,
    })),
  };
}
