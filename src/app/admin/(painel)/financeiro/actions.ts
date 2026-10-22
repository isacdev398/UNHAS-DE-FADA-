"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { dbErrorMessage, type ActionResult } from "@/lib/errors";
import { parseBRL } from "@/lib/format";
import { createSessionClient } from "@/lib/supabase/server";

export async function createExpenseAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const amount = parseBRL(String(form.get("amount") ?? ""));
  const parsed = z
    .object({
      description: z.string().trim().min(1).max(120),
      category: z.string().trim().min(1).max(40),
      spentOn: z.iso.date(),
      methodId: z.union([z.uuid(), z.literal("")]),
    })
    .safeParse({ description: form.get("description"), category: form.get("category") || "Geral", spentOn: form.get("spentOn"), methodId: form.get("methodId") ?? "" });
  if (!parsed.success) return { ok: false, error: "Informe descrição e data." };
  if (!amount || amount <= 0) return { ok: false, error: "Informe o valor." };

  const { error } = await (await createSessionClient()).from("expenses").insert({
    description: parsed.data.description,
    category: parsed.data.category,
    amount_cents: amount,
    spent_on: parsed.data.spentOn,
    method_id: parsed.data.methodId || null,
    created_by: admin.id,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/financeiro", "layout");
  return { ok: true, message: "Despesa registrada." };
}

export async function voidExpenseAction(id: string, reason: string): Promise<ActionResult> {
  await requireAdmin();
  if (reason.trim().length < 3) return { ok: false, error: "Informe o motivo." };
  const { error } = await (await createSessionClient())
    .from("expenses")
    .update({ voided_at: new Date().toISOString(), void_reason: reason.trim().slice(0, 300) })
    .eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/financeiro", "layout");
  return { ok: true, message: "Despesa estornada." };
}
