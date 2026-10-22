import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/admin/ui";
import { getAdminSettings } from "@/lib/data/admin";
import { createSessionClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Histórico de alterações" };

const TABLE = {
  appointments: "Agendamento",
  payments: "Pagamento",
  expenses: "Despesa",
  services: "Serviço",
  promotions: "Promoção",
  settings: "Regras",
  site_content: "Site publicado",
  business_hours: "Horário",
  time_blocks: "Bloqueio",
  clients: "Cliente",
} as Record<string, string>;

const ACTION = { insert: "criou", update: "alterou", delete: "removeu" } as Record<string, string>;

function describe(table: string, oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) {
  if (!oldData || !newData) return "";
  const changed = Object.keys(newData).filter((k) => k !== "updated_at" && JSON.stringify(newData[k]) !== JSON.stringify(oldData[k]));
  if (table === "appointments" && changed.includes("status")) return `status: ${oldData.status} → ${newData.status}`;
  if (table === "payments" && changed.includes("voided_at")) return `estorno: ${newData.void_reason}`;
  return changed.length ? `campos: ${changed.join(", ")}` : "";
}

export default async function AuditPage() {
  await connection();
  const settings = await getAdminSettings();
  const { data } = await (await createSessionClient())
    .from("audit_log")
    .select("id, actor, action, table_name, old_data, new_data, created_at")
    .order("created_at", { ascending: false })
    .limit(150);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: settings.tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <PageHeader title="Histórico de alterações" back={{ href: "/admin/configuracoes", label: "Configurações" }} description="Registro automático das operações importantes (últimas 150)." />
      <ul className="divide-y divide-nude/70 rounded-2xl bg-shell text-sm shadow-soft">
        {(data ?? []).map((r) => (
          <li key={r.id} className="px-4 py-2.5">
            <p>
              <span className="text-cocoa-soft tabular">{fmt.format(new Date(r.created_at))}</span> · {r.actor ? "Você" : "Site/cliente"} {ACTION[r.action] ?? r.action}{" "}
              <strong>{TABLE[r.table_name] ?? r.table_name}</strong>
            </p>
            <p className="text-[13px] text-cocoa-soft">{describe(r.table_name, r.old_data, r.new_data)}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
