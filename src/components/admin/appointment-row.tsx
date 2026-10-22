import { Badge } from "@/components/ui/misc";
import type { AdminAppointment } from "@/lib/data/admin";
import { formatBRL } from "@/lib/format";
import { formatTime } from "@/lib/time";
import { ListLink, STATUS_LABEL } from "./ui";

export function AppointmentRow({ appt, tz, showDate }: { appt: AdminAppointment; tz: string; showDate?: string }) {
  const status = STATUS_LABEL[appt.status];
  const due = appt.status === "completed" && appt.paidCents < appt.totalCents;
  return (
    <li>
      <ListLink href={`/admin/agenda/${appt.id}`}>
        <div className="w-14 shrink-0 text-center">
          {showDate && <p className="text-[11px] text-cocoa-soft">{showDate}</p>}
          <p className="font-semibold tabular text-rose-ink">{formatTime(appt.startsAt, tz)}</p>
          <p className="text-[11px] tabular text-cocoa-soft">{formatTime(appt.endsAt, tz)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{appt.client.name}</p>
          <p className="truncate text-sm text-cocoa-soft">{appt.items.map((i) => i.name).join(" + ")}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm tabular">{formatBRL(appt.totalCents)}</span>
          {due ? <Badge tone="amber">A receber</Badge> : appt.status !== "confirmed" && <Badge tone={status.tone}>{status.label}</Badge>}
        </div>
      </ListLink>
    </li>
  );
}
