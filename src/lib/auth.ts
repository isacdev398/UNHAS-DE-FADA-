import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "./env";
import { createSessionClient } from "./supabase/server";

export type Admin = { id: string; name: string; email: string };

/**
 * Administradora da sessão atual, validada no servidor: o token é conferido
 * no Supabase Auth (getUser) e a usuária precisa estar em public.admins.
 */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: admin } = await supabase.from("admins").select("name").eq("user_id", data.user.id).maybeSingle();
  if (!admin) return null;
  return { id: data.user.id, name: admin.name, email: data.user.email ?? "" };
});

/** Use no início de toda página e Server Action do painel. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/entrar");
  return admin;
}
