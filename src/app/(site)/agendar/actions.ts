"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createBooking, serviceIdsSchema } from "@/lib/booking";
import { isSupabaseConfigured } from "@/lib/env";
import { normalizePhone } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";

const bookingSchema = z.object({
  serviceIds: serviceIdsSchema,
  startsAt: z.iso.datetime(),
  name: z.string().trim().min(2, { error: "Informe seu nome." }).max(80, { error: "Nome muito longo." }),
  phone: z.string().trim().max(30),
  privacy: z.literal(true, { error: "Confirme que leu a política de privacidade." }),
  // Campo invisível: robôs preenchem, pessoas não.
  website: z.string().max(0).optional(),
});

export type BookingState = {
  error?: string;
  code?: "slot" | "services";
  fieldErrors?: Partial<Record<"name" | "phone" | "privacy", string>>;
} | null;

export async function confirmBooking(input: unknown): Promise<BookingState> {
  if (!isSupabaseConfigured()) return { error: "O agendamento online ainda não foi configurado. Chame a gente no WhatsApp." };

  const parsed = bookingSchema.safeParse(input);
  // Telefone validado junto com os demais campos: todos os erros aparecem de uma vez.
  const rawPhone = typeof input === "object" && input && "phone" in input ? String(input.phone) : "";
  const phone = normalizePhone(rawPhone);
  const phoneError = phone ? undefined : "Informe um WhatsApp com DDD. Ex.: (86) 99999-9999";
  if (!parsed.success || !phone) {
    const flat = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
    return {
      error: "Confira os campos destacados.",
      fieldErrors: { name: flat.name?.[0], phone: phoneError, privacy: flat.privacy?.[0] },
    };
  }

  if (!(await rateLimit("booking", 6, 600))) {
    return { error: "Muitas tentativas seguidas. Aguarde alguns minutos ou chame no WhatsApp." };
  }

  const result = await createBooking({
    serviceIds: parsed.data.serviceIds,
    startsAt: new Date(parsed.data.startsAt),
    client: { name: parsed.data.name, phone },
    source: "online",
  });

  if (!result.ok) {
    if (result.reason === "slot") return { code: "slot", error: "Esse horário acabou de ser ocupado. Escolha outro, por favor." };
    if (result.reason === "services") return { code: "services", error: "Os serviços ou preços mudaram. Revise a seleção." };
    console.error("Falha ao agendar", result.error);
    return { error: "Não foi possível concluir o agendamento. Tente de novo ou chame no WhatsApp." };
  }

  redirect(`/meu-agendamento/${result.token}?novo=1`);
}
