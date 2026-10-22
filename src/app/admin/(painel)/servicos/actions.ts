"use server";

import { updateTag } from "next/cache";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { CATALOG_TAG } from "@/lib/data/public";
import { dbErrorMessage, type ActionResult } from "@/lib/errors";
import { parseBRL, slugify } from "@/lib/format";
import { createSessionClient } from "@/lib/supabase/server";

function refresh() {
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/servicos", "layout");
}

const serviceSchema = z.object({
  name: z.string().trim().min(1, { error: "Informe o nome." }).max(80),
  description: z.string().trim().max(600),
  durationMinutes: z.coerce.number().int().min(5, { error: "Duração mínima: 5 min." }).max(600),
  categoryId: z.union([z.uuid(), z.literal("")]),
  sort: z.coerce.number().int().min(0).max(999),
  active: z.boolean(),
  featured: z.boolean(),
  comboServiceIds: z.array(z.uuid()).max(10),
});

export async function saveServiceAction(id: string | null, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const price = parseBRL(String(form.get("price") ?? ""));
  const parsed = serviceSchema.safeParse({
    name: form.get("name"),
    description: form.get("description") ?? "",
    durationMinutes: form.get("durationMinutes"),
    categoryId: form.get("categoryId") ?? "",
    sort: form.get("sort") || 0,
    active: form.get("active") === "on",
    featured: form.get("featured") === "on",
    comboServiceIds: form.getAll("comboServiceIds").map(String).filter((x) => x !== id),
  });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return { ok: false, error: "Confira os campos.", fieldErrors: { name: fe.name?.[0] ?? "", durationMinutes: fe.durationMinutes?.[0] ?? "" } };
  }
  if (price === null) return { ok: false, error: "Confira o preço.", fieldErrors: { price: "Ex.: 20 ou 20,50" } };
  const s = parsed.data;
  const db = await createSessionClient();
  const row = {
    name: s.name,
    description: s.description,
    price_cents: price,
    duration_minutes: s.durationMinutes,
    category_id: s.categoryId || null,
    sort: s.sort,
    active: s.active,
    featured: s.featured,
    is_combo: s.comboServiceIds.length > 0,
  };

  let serviceId = id;
  if (id) {
    const { error } = await db.from("services").update(row).eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };
  } else {
    const base = slugify(s.name) || "servico";
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const { count } = await db.from("services").select("id", { count: "exact", head: true }).eq("slug", slug);
      if (!count) break;
      slug = `${base}-${i}`;
    }
    const { data, error } = await db.from("services").insert({ ...row, slug }).select("id").single();
    if (error) return { ok: false, error: dbErrorMessage(error) };
    serviceId = data.id;
  }

  await db.from("combo_items").delete().eq("combo_id", serviceId!);
  if (s.comboServiceIds.length) {
    const { error } = await db.from("combo_items").insert(s.comboServiceIds.map((sid) => ({ combo_id: serviceId, service_id: sid })));
    if (error) return { ok: false, error: dbErrorMessage(error) };
  }
  refresh();
  if (!id) redirect("/admin/servicos");
  return { ok: true, message: "Serviço salvo. O site já mostra a alteração." };
}

export async function toggleServiceAction(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await (await createSessionClient()).from("services").update({ active }).eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  refresh();
  return { ok: true };
}

export async function addCategoryAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 60) return { ok: false, error: "Informe o nome da categoria." };
  const { error } = await (await createSessionClient()).from("service_categories").insert({ name, sort: 99 });
  if (error) return { ok: false, error: error.message.includes("duplicate") ? "Essa categoria já existe." : dbErrorMessage(error) };
  refresh();
  return { ok: true, message: "Categoria criada." };
}

// ---------------------------------------------------------------------------
// Promoções: escolher serviços, preço promocional e validade. Só isso.
// ---------------------------------------------------------------------------

export async function savePromotionAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const price = parseBRL(String(form.get("price") ?? ""));
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(80),
      description: z.string().trim().max(400),
      startsOn: z.iso.date(),
      endsOn: z.iso.date(),
      serviceIds: z.array(z.uuid()).min(1).max(10),
    })
    .refine((p) => p.endsOn >= p.startsOn)
    .safeParse({
      title: form.get("title"),
      description: form.get("description") ?? "",
      startsOn: form.get("startsOn"),
      endsOn: form.get("endsOn"),
      serviceIds: form.getAll("serviceIds").map(String),
    });
  if (!parsed.success) return { ok: false, error: "Escolha os serviços, dê um nome e confira as datas." };
  if (price === null) return { ok: false, error: "Informe o preço promocional." };

  const db = await createSessionClient();
  const { data: services } = await db.from("services").select("price_cents").in("id", parsed.data.serviceIds);
  const full = (services ?? []).reduce((s, x) => s + (x.price_cents as number), 0);
  if (price >= full) return { ok: false, error: "O preço promocional precisa ser menor que o preço normal." };

  const { data, error } = await db
    .from("promotions")
    .insert({ title: parsed.data.title, description: parsed.data.description, promo_price_cents: price, starts_on: parsed.data.startsOn, ends_on: parsed.data.endsOn })
    .select("id")
    .single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  const link = await db.from("promotion_services").insert(parsed.data.serviceIds.map((sid) => ({ promotion_id: data.id, service_id: sid })));
  if (link.error) {
    await db.from("promotions").delete().eq("id", data.id);
    return { ok: false, error: dbErrorMessage(link.error) };
  }
  refresh();
  return { ok: true, message: "Promoção criada. Ela já aparece no site e no agendamento." };
}

export async function togglePromotionAction(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await (await createSessionClient()).from("promotions").update({ active }).eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  refresh();
  return { ok: true };
}
