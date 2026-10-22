import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DEFAULT_CONTENT, parseContent } from "../content";
import { isSupabaseConfigured, storagePublicUrl } from "../env";
import type { ActivePromotion } from "../pricing";
import { createPublicClient } from "../supabase/public";

/** Tag única para tudo que aparece na vitrine; invalidada a cada alteração no painel. */
export const CATALOG_TAG = "catalog";

export type CatalogService = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  categoryId: string | null;
  featured: boolean;
  isCombo: boolean;
  comboServiceIds: string[];
};

export type CatalogCategory = { id: string; name: string };

export type CatalogPromotion = ActivePromotion & { description: string };

export type Catalog = {
  services: CatalogService[];
  categories: CatalogCategory[];
  promotions: CatalogPromotion[];
};

export type GalleryPhoto = {
  id: string;
  url: string;
  alt: string;
  serviceId: string | null;
  featured: boolean;
  width: number | null;
  height: number | null;
};

export type Testimonial = { id: string; authorName: string; body: string; rating: number | null };

/** Catálogo inicial (tabela de preços oficial) para quando o banco ainda não está configurado. */
const FALLBACK_CATALOG: Catalog = {
  categories: [
    { id: "00000000-0000-4000-8000-0000000000c1", name: "Manicure" },
    { id: "00000000-0000-4000-8000-0000000000c2", name: "Pedicure" },
    { id: "00000000-0000-4000-8000-0000000000c3", name: "Combos" },
  ],
  services: [
    {
      id: "00000000-0000-4000-8000-0000000000a1",
      slug: "mao",
      name: "Mão",
      description: "Manicure completa: cutilagem, lixa e esmaltação.",
      priceCents: 2000,
      durationMinutes: 45,
      categoryId: "00000000-0000-4000-8000-0000000000c1",
      featured: true,
      isCombo: false,
      comboServiceIds: [],
    },
    {
      id: "00000000-0000-4000-8000-0000000000a2",
      slug: "pe",
      name: "Pé",
      description: "Pedicure completa: cutilagem, lixa e esmaltação.",
      priceCents: 2000,
      durationMinutes: 50,
      categoryId: "00000000-0000-4000-8000-0000000000c2",
      featured: true,
      isCombo: false,
      comboServiceIds: [],
    },
    {
      id: "00000000-0000-4000-8000-0000000000a3",
      slug: "mao-e-pe",
      name: "Mão e Pé",
      description: "Manicure e pedicure no mesmo horário.",
      priceCents: 4000,
      durationMinutes: 90,
      categoryId: "00000000-0000-4000-8000-0000000000c3",
      featured: true,
      isCombo: true,
      comboServiceIds: ["00000000-0000-4000-8000-0000000000a1", "00000000-0000-4000-8000-0000000000a2"],
    },
  ],
  promotions: [],
};

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  if (!isSupabaseConfigured()) return FALLBACK_CATALOG;

  const db = createPublicClient();
  const [services, categories, combos, promotions] = await Promise.all([
    db
      .from("services")
      .select("id, slug, name, description, price_cents, duration_minutes, category_id, featured, is_combo, sort")
      .eq("active", true)
      .order("sort")
      .order("name"),
    db.from("service_categories").select("id, name").order("sort"),
    db.from("combo_items").select("combo_id, service_id"),
    db
      .from("promotions")
      .select("id, title, description, promo_price_cents, starts_on, ends_on, promotion_services(service_id)")
      .eq("active", true)
      .order("ends_on"),
  ]);
  for (const r of [services, categories, combos, promotions]) if (r.error) throw r.error;

  const activeIds = new Set((services.data ?? []).map((s) => s.id as string));
  return {
    services: (services.data ?? []).map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      priceCents: s.price_cents,
      durationMinutes: s.duration_minutes,
      categoryId: s.category_id,
      featured: s.featured,
      isCombo: s.is_combo,
      comboServiceIds: (combos.data ?? []).filter((c) => c.combo_id === s.id).map((c) => c.service_id as string),
    })),
    categories: categories.data ?? [],
    promotions: (promotions.data ?? [])
      .map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        promoPriceCents: p.promo_price_cents,
        startsOn: p.starts_on,
        endsOn: p.ends_on,
        serviceIds: ((p.promotion_services ?? []) as { service_id: string }[]).map((x) => x.service_id),
      }))
      // Promoção com serviço desativado não pode ser contratada
      .filter((p) => p.serviceIds.length > 0 && p.serviceIds.every((id) => activeIds.has(id))),
  };
}

export async function getPublishedContent() {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  if (!isSupabaseConfigured()) return DEFAULT_CONTENT;
  const { data, error } = await createPublicClient().from("site_content").select("published").eq("id", 1).maybeSingle();
  if (error) throw error;
  return parseContent(data?.published);
}

export async function getGallery(): Promise<GalleryPhoto[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createPublicClient()
    .from("gallery_photos")
    .select("id, storage_path, alt, service_id, featured, width, height")
    .order("featured", { ascending: false })
    .order("sort")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    url: storagePublicUrl(p.storage_path),
    alt: p.alt,
    serviceId: p.service_id,
    featured: p.featured,
    width: p.width,
    height: p.height,
  }));
}

export async function getTestimonials(): Promise<Testimonial[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createPublicClient()
    .from("testimonials")
    .select("id, author_name, body, rating")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, authorName: t.author_name, body: t.body, rating: t.rating }));
}

export type BookingPolicy = {
  allowClientCancel: boolean;
  cancelMinHours: number;
  allowClientReschedule: boolean;
  rescheduleMinHours: number;
};

/** Regras de cancelamento/reagendamento mostradas no agendamento (leitura pública). */
export async function getBookingPolicy(): Promise<BookingPolicy> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const fallback = { allowClientCancel: true, cancelMinHours: 12, allowClientReschedule: true, rescheduleMinHours: 12 };
  if (!isSupabaseConfigured()) return fallback;
  const { data } = await createPublicClient()
    .from("settings")
    .select("allow_client_cancel, cancel_min_hours, allow_client_reschedule, reschedule_min_hours")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return fallback;
  return {
    allowClientCancel: data.allow_client_cancel,
    cancelMinHours: data.cancel_min_hours,
    allowClientReschedule: data.allow_client_reschedule,
    rescheduleMinHours: data.reschedule_min_hours,
  };
}
