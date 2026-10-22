/**
 * Variáveis de ambiente. As públicas (NEXT_PUBLIC_*) vão para o navegador;
 * SUPABASE_SECRET_KEY e as demais ficam só no servidor.
 */

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function supabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** Host público das imagens do Supabase Storage (para next/image). */
export function storagePublicUrl(path: string) {
  if (!path) return "";
  return `${supabaseUrl()}/storage/v1/object/public/gallery/${path.split("/").map(encodeURIComponent).join("/")}`;
}
