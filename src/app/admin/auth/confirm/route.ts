import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

/** Link de e-mail do Supabase (recuperação de senha). Só redireciona para dentro do painel. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = params.get("next") ?? "/admin";
  const safeNext = next.startsWith("/admin/") && !next.startsWith("//") ? next : "/admin";

  if (tokenHash && type) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(safeNext);
  }
  redirect("/admin/entrar");
}
