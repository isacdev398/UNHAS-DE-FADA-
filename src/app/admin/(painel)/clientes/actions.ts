"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { dbErrorMessage, type ActionResult } from "@/lib/errors";
import { normalizePhone } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

const clientSchema = z.object({
  name: z.string().trim().min(2, { error: "Informe o nome." }).max(120),
  phone: z.string().trim().max(30),
  notes: z.string().trim().max(2000),
});

function parseClient(form: FormData): { error: ActionResult; data?: never } | { data: { name: string; phone: string; notes: string }; error?: never } {
  const parsed = clientSchema.safeParse({ name: form.get("name"), phone: form.get("phone"), notes: form.get("notes") ?? "" });
  if (!parsed.success) return { error: { ok: false, error: "Confira os campos.", fieldErrors: { name: "Informe o nome." } } };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: { ok: false, error: "Confira os campos.", fieldErrors: { phone: "WhatsApp com DDD. Ex.: (86) 99999-9999" } } };
  return { data: { ...parsed.data, phone } };
}

export async function createClientAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const r = parseClient(form);
  if (r.error) return r.error;
  const { data, error } = await (await createSessionClient()).from("clients").insert(r.data).select("id").single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  redirect(`/admin/clientes/${data.id}`);
}

export async function updateClientAction(id: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const r = parseClient(form);
  if (r.error) return r.error;
  const { error } = await (await createSessionClient()).from("clients").update(r.data).eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/admin/clientes/${id}`);
  return { ok: true, message: "Dados salvos." };
}

/** LGPD: remove nome, telefone e observações. O histórico financeiro fica, sem identificação. */
export async function anonymizeClientAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const { error } = await createServiceClient().rpc("anonymize_client", { p_client_id: id, p_actor: admin.id });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}
