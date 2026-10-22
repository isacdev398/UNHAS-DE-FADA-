"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createSessionClient } from "@/lib/supabase/server";

export type AuthState = { ok: boolean; error?: string; message?: string } | null;

const loginSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }),
  password: z.string().min(1, { error: "Informe a senha." }),
});

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase não configurado. Veja o README." };
  const parsed = loginSchema.safeParse({ email: String(form.get("email") ?? "").trim(), password: form.get("password") });
  if (!parsed.success) return { ok: false, error: z.flattenError(parsed.error).fieldErrors.email?.[0] ?? "Confira os dados." };
  if (!(await rateLimit("login", 8, 900))) return { ok: false, error: "Muitas tentativas. Aguarde 15 minutos." };

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // Mensagem única: não revela se o e-mail existe.
  if (error || !data.user) return { ok: false, error: "E-mail ou senha incorretos." };

  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { ok: false, error: "E-mail ou senha incorretos." };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/entrar");
}

export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase não configurado." };
  const email = z.email().safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) return { ok: false, error: "Informe um e-mail válido." };
  if (!(await rateLimit("reset", 3, 900))) return { ok: false, error: "Muitas tentativas. Aguarde 15 minutos." };
  const supabase = await createSessionClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${siteUrl()}/admin/auth/confirm?next=/admin/nova-senha` });
  return { ok: true, message: "Se este e-mail tiver acesso, você vai receber um link para criar uma nova senha." };
}

export async function updatePassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { ok: false, error: "Use pelo menos 10 caracteres." };
  if (password !== String(form.get("confirm") ?? "")) return { ok: false, error: "As senhas não conferem." };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: "Não foi possível trocar a senha. Peça um novo link." };
  redirect("/admin");
}
