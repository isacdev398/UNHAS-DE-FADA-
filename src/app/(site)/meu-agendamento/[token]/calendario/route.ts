import { connection } from "next/server";
import { findByToken } from "@/lib/data/manage";
import { getPublishedContent } from "@/lib/data/public";
import { isSupabaseConfigured } from "@/lib/env";

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string) {
  return text.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
}

/** Arquivo .ics para salvar o horário na agenda do celular. */
export async function GET(_request: Request, ctx: RouteContext<"/meu-agendamento/[token]/calendario">) {
  await connection();
  if (!isSupabaseConfigured()) return new Response("Não encontrado", { status: 404 });
  const { token } = await ctx.params;
  const appt = await findByToken(token);
  if (!appt || appt.status !== "confirmed") return new Response("Não encontrado", { status: 404 });
  const content = await getPublishedContent();

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Unhas de Fada//Agendamento//PT-BR",
    "BEGIN:VEVENT",
    `UID:${appt.id}@unhasdefada`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(appt.startsAt)}`,
    `DTEND:${icsDate(appt.endsAt)}`,
    `SUMMARY:${escape(`Unhas de Fada — ${appt.items.map((i) => i.name).join(" + ")}`)}`,
    content.address ? `LOCATION:${escape(`${content.address}${content.city ? `, ${content.city}` : ""}`)}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lembrete do seu horário",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="unhas-de-fada.ics"',
      "cache-control": "no-store",
    },
  });
}
