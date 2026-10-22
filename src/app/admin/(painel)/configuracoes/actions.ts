"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { siteContentSchema } from "@/lib/content";
import { CATALOG_TAG } from "@/lib/data/public";
import { dbErrorMessage, type ActionResult } from "@/lib/errors";
import { isWhatsAppProviderConfigured } from "@/lib/notifications";
import { createSessionClient } from "@/lib/supabase/server";

function refreshSite() {
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/configuracoes", "layout");
}

// ---------------------------------------------------------------------------
// Conteúdo do site: rascunho → pré-visualização → publicação
// ---------------------------------------------------------------------------

export async function saveDraftAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const raw = Object.fromEntries(Object.keys(siteContentSchema.shape).map((k) => [k, String(form.get(k) ?? "")]));
  raw.whatsapp = raw.whatsapp.replace(/\D/g, "");
  if (raw.whatsapp.length === 10 || raw.whatsapp.length === 11) raw.whatsapp = `55${raw.whatsapp}`;
  const parsed = siteContentSchema.safeParse(raw);
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
    return { ok: false, error: "Confira os campos destacados.", fieldErrors: Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0] ?? ""])) };
  }
  const { error } = await (await createSessionClient()).from("site_content_draft").update({ draft: parsed.data }).eq("id", 1);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/configuracoes/site");
  if (form.get("intent") === "preview") redirect("/admin/previa");
  return { ok: true, message: "Rascunho salvo. Veja a pré-visualização e publique quando estiver pronto." };
}

export async function publishAction(): Promise<ActionResult> {
  await requireAdmin();
  const db = await createSessionClient();
  const { data, error } = await db.from("site_content_draft").select("draft").eq("id", 1).single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  const parsed = siteContentSchema.safeParse(data.draft);
  if (!parsed.success) return { ok: false, error: "O rascunho tem campos inválidos. Revise antes de publicar." };
  const upd = await db.from("site_content").update({ published: parsed.data, published_at: new Date().toISOString() }).eq("id", 1);
  if (upd.error) return { ok: false, error: dbErrorMessage(upd.error) };
  refreshSite();
  return { ok: true, message: "Publicado! O site já mostra as alterações." };
}

export async function discardDraftAction(): Promise<ActionResult> {
  await requireAdmin();
  const db = await createSessionClient();
  const { data } = await db.from("site_content").select("published").eq("id", 1).single();
  const { error } = await db.from("site_content_draft").update({ draft: data?.published ?? {} }).eq("id", 1);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/configuracoes/site");
  return { ok: true, message: "Rascunho descartado: voltou ao que está publicado." };
}

// ---------------------------------------------------------------------------
// Galeria (Supabase Storage)
// ---------------------------------------------------------------------------

const MAX_BYTES = 5 * 1024 * 1024;
const MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function uploadPhotoAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha uma foto." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Foto muito grande (máx. 5 MB)." };
  if (!MIME.includes(file.type)) return { ok: false, error: "Use JPG, PNG, WEBP ou AVIF." };
  const meta = z
    .object({
      alt: z.string().trim().max(200),
      serviceId: z.union([z.uuid(), z.literal("")]),
      width: z.coerce.number().int().min(1).max(10000).optional(),
      height: z.coerce.number().int().min(1).max(10000).optional(),
    })
    .safeParse({ alt: form.get("alt") ?? "", serviceId: form.get("serviceId") ?? "", width: form.get("width") || undefined, height: form.get("height") || undefined });
  if (!meta.success) return { ok: false, error: "Confira os dados da foto." };

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${new Date().getFullYear()}/${randomUUID()}.${ext}`;
  const db = await createSessionClient();
  const up = await db.storage.from("gallery").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (up.error) return { ok: false, error: "Não foi possível enviar a foto. Tente de novo." };

  const { error } = await db.from("gallery_photos").insert({
    storage_path: path,
    alt: meta.data.alt,
    service_id: meta.data.serviceId || null,
    width: meta.data.width ?? null,
    height: meta.data.height ?? null,
  });
  if (error) {
    await db.storage.from("gallery").remove([path]);
    return { ok: false, error: dbErrorMessage(error) };
  }
  refreshSite();
  return { ok: true, message: "Foto enviada para a galeria." };
}

export async function updatePhotoAction(id: string, patch: { alt?: string; serviceId?: string | null; featured?: boolean; sort?: number }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      alt: z.string().trim().max(200).optional(),
      serviceId: z.union([z.uuid(), z.null()]).optional(),
      featured: z.boolean().optional(),
      sort: z.number().int().min(-1000).max(1000).optional(),
    })
    .safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const p = parsed.data;
  const row: Record<string, unknown> = {};
  if (p.alt !== undefined) row.alt = p.alt;
  if (p.serviceId !== undefined) row.service_id = p.serviceId;
  if (p.featured !== undefined) row.featured = p.featured;
  if (p.sort !== undefined) row.sort = p.sort;
  const { error } = await (await createSessionClient()).from("gallery_photos").update(row).eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  refreshSite();
  return { ok: true };
}

export async function deletePhotoAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const db = await createSessionClient();
  const { data } = await db.from("gallery_photos").select("storage_path").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "Foto não encontrada." };
  const { error } = await db.from("gallery_photos").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  await db.storage.from("gallery").remove([data.storage_path]);
  refreshSite();
  return { ok: true, message: "Foto excluída." };
}

// ---------------------------------------------------------------------------
// Avaliações
// ---------------------------------------------------------------------------

export async function createTestimonialAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      authorName: z.string().trim().min(1).max(60),
      body: z.string().trim().min(1).max(600),
      rating: z.union([z.coerce.number().int().min(1).max(5), z.literal("")]),
      consent: z.literal(true),
    })
    .safeParse({ authorName: form.get("authorName"), body: form.get("body"), rating: form.get("rating") ?? "", consent: form.get("consent") === "on" });
  if (!parsed.success) return { ok: false, error: "Preencha nome e texto, e confirme a autorização da cliente." };
  const { error } = await (await createSessionClient()).from("testimonials").insert({
    author_name: parsed.data.authorName,
    body: parsed.data.body,
    rating: parsed.data.rating === "" ? null : parsed.data.rating,
    published: true,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  refreshSite();
  return { ok: true, message: "Avaliação publicada." };
}

export async function toggleTestimonialAction(id: string, published: boolean): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await (await createSessionClient()).from("testimonials").update({ published }).eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  refreshSite();
  return { ok: true };
}

export async function deleteTestimonialAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await (await createSessionClient()).from("testimonials").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  refreshSite();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Formas de pagamento
// ---------------------------------------------------------------------------

export async function addPaymentMethodAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 40) return { ok: false, error: "Informe o nome." };
  const { error } = await (await createSessionClient()).from("payment_methods").insert({ name, sort: 50 });
  if (error) return { ok: false, error: error.message.includes("duplicate") ? "Essa forma já existe." : dbErrorMessage(error) };
  revalidatePath("/admin/configuracoes/pagamentos");
  return { ok: true, message: "Forma de pagamento adicionada." };
}

export async function togglePaymentMethodAction(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await (await createSessionClient()).from("payment_methods").update({ active }).eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/configuracoes/pagamentos");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// WhatsApp automático (desativado até haver um provedor configurado)
// ---------------------------------------------------------------------------

export async function toggleWhatsAppAction(enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (enabled && !isWhatsAppProviderConfigured()) {
    return { ok: false, error: "Nenhum provedor de WhatsApp configurado. Veja docs/whatsapp.md." };
  }
  const { error } = await (await createSessionClient()).from("settings").update({ whatsapp_notifications_enabled: enabled }).eq("id", 1);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/configuracoes/whatsapp");
  return { ok: true, message: enabled ? "Mensagens automáticas ativadas." : "Mensagens automáticas desativadas." };
}
