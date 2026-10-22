"use client";

import { useState, useTransition } from "react";
import { Section } from "@/components/admin/ui";
import { Button, Spinner, buttonClass } from "@/components/ui/button";
import { useAsync } from "@/components/ui/use-async";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { IconCheck, IconWhatsApp } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/errors";
import { formatBRL, whatsappUrl } from "@/lib/format";
import { formatTime } from "@/lib/time";
import {
  cancelAction,
  recordPaymentAction,
  rescheduleAction,
  rescheduleSlotsAction,
  setStatusAction,
  shareLinkAction,
  updateNotesAction,
  voidPaymentAction,
} from "../actions";

type Props = {
  appt: {
    id: string;
    status: "confirmed" | "completed" | "cancelled" | "no_show";
    dueCents: number;
    notes: string;
    clientName: string;
    clientPhone: string;
    whenLabel: string;
    services: string;
    date: string;
  };
  payments: { id: string; amountCents: number; paidAt: string; method: string; notes: string; voidedAt: string | null; voidReason: string | null }[];
  methods: { id: string; name: string }[];
  newLink: string | null;
  tz: string;
};

export function AppointmentActions({ appt, payments, methods, newLink, tz }: Props) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<"none" | "cancel" | "reschedule">("none");
  const [link, setLink] = useState<string | null>(newLink);

  const run = (fn: () => Promise<ActionResult | undefined>) =>
    start(async () => {
      const r = await fn();
      if (r) setResult(r);
      if (r?.ok) setPanel("none");
    });

  const firstName = appt.clientName.split(" ")[0];
  const confirmText = `Oi, ${firstName}! Seu horário no Unhas de Fada está confirmado: ${appt.whenLabel} (${appt.services}).${link ? `\nPara ver, reagendar ou cancelar: ${link}` : ""}`;
  const reminderText = `Oi, ${firstName}! Passando para lembrar do seu horário no Unhas de Fada: ${appt.whenLabel} (${appt.services}). Te espero!`;
  const active = appt.status === "confirmed";

  return (
    <div>
      <div aria-live="polite" className="mt-4">
        <FormMessage result={result} />
      </div>

      {/* Ações principais */}
      {active && panel === "none" && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="lg" className="col-span-2" disabled={pending} onClick={() => run(() => setStatusAction(appt.id, "completed"))}>
            {pending ? <Spinner /> : <IconCheck />} Marcar como realizado
          </Button>
          <Button variant="secondary" onClick={() => setPanel("reschedule")}>
            Reagendar
          </Button>
          <Button variant="danger" onClick={() => setPanel("cancel")}>
            Cancelar
          </Button>
          <Button variant="ghost" className="col-span-2" disabled={pending} onClick={() => run(() => setStatusAction(appt.id, "no_show"))}>
            Cliente não compareceu
          </Button>
        </div>
      )}
      {(appt.status === "completed" || appt.status === "no_show") && (
        <Button variant="ghost" className="mt-3" disabled={pending} onClick={() => run(() => setStatusAction(appt.id, "confirmed"))}>
          Voltar para confirmado
        </Button>
      )}

      {panel === "cancel" && (
        <form
          className="mt-4 space-y-3 rounded-2xl bg-shell p-4 ring-1 ring-nude"
          action={(f) => run(() => cancelAction(appt.id, String(f.get("reason") ?? "")))}
        >
          <p className="font-semibold">Cancelar este agendamento?</p>
          <Field label="Motivo (opcional)" htmlFor="reason">
            <Input id="reason" name="reason" maxLength={300} />
          </Field>
          <div className="flex gap-2">
            <SubmitButton variant="danger" pending={pending}>
              Sim, cancelar
            </SubmitButton>
            <Button variant="ghost" onClick={() => setPanel("none")}>
              Voltar
            </Button>
          </div>
        </form>
      )}

      {panel === "reschedule" && <ReschedulePanel id={appt.id} initialDate={appt.date} tz={tz} onDone={(r) => { setResult(r); if (r.ok) setPanel("none"); }} onClose={() => setPanel("none")} />}

      {/* WhatsApp manual (gratuito) */}
      {active && (
        <Section title="Mensagens para a cliente">
          <div className="space-y-2">
            {link ? (
              <div className="rounded-2xl bg-sage-soft p-3 text-sm text-sage">
                <p className="font-medium">Link da cliente para consultar, reagendar ou cancelar:</p>
                <p className="mt-1 break-all">{link}</p>
              </div>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await shareLinkAction(appt.id);
                    if (r.ok && r.data) setLink(r.data.url);
                  })
                }
              >
                Gerar link da cliente
              </Button>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <a className={buttonClass("whatsapp", "md")} href={whatsappUrl(appt.clientPhone, confirmText)} target="_blank" rel="noreferrer">
                <IconWhatsApp size={18} /> Enviar confirmação
              </a>
              <a className={buttonClass("secondary", "md")} href={whatsappUrl(appt.clientPhone, reminderText)} target="_blank" rel="noreferrer">
                <IconWhatsApp size={18} className="text-sage" /> Enviar lembrete
              </a>
            </div>
          </div>
        </Section>
      )}

      {/* Pagamento */}
      {appt.status !== "cancelled" && (
        <Section title="Pagamento">
          {payments.length > 0 && (
            <ul className="mb-3 divide-y divide-nude/70 rounded-2xl bg-shell shadow-soft">
              {payments.map((p) => (
                <PaymentRow key={p.id} payment={p} tz={tz} onResult={setResult} />
              ))}
            </ul>
          )}
          {appt.dueCents > 0 ? (
            // key: a cada pagamento ou estorno o formulário recomeça com o saldo restante
            <PaymentForm key={appt.dueCents} appointmentId={appt.id} dueCents={appt.dueCents} methods={methods} onSuccess={setResult} />
          ) : (
            <p className="rounded-2xl bg-sage-soft px-4 py-3 text-sm font-medium text-sage">Pagamento completo.</p>
          )}
        </Section>
      )}

      <NotesForm id={appt.id} initial={appt.notes} />
    </div>
  );
}

function PaymentForm({
  appointmentId,
  dueCents,
  methods,
  onSuccess,
}: {
  appointmentId: string;
  dueCents: number;
  methods: Props["methods"];
  onSuccess: (r: ActionResult) => void;
}) {
  const [error, setError] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(form) =>
        start(async () => {
          const r = await recordPaymentAction(appointmentId, null, form);
          if (r.ok) onSuccess(r);
          else setError(r);
        })
      }
      className="space-y-3 rounded-2xl bg-shell p-4 ring-1 ring-nude"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)" htmlFor="amount">
          <Input id="amount" name="amount" inputMode="decimal" defaultValue={(dueCents / 100).toFixed(2).replace(".", ",")} required />
        </Field>
        <Field label="Forma" htmlFor="methodId">
          <Select id="methodId" name="methodId" required defaultValue="">
            <option value="" disabled>
              Escolha…
            </option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Observação (opcional)" htmlFor="pnotes">
        <Input id="pnotes" name="notes" maxLength={300} />
      </Field>
      <FormMessage result={error} />
      <SubmitButton size="lg" className="w-full" pending={pending}>
        Registrar pagamento
      </SubmitButton>
    </form>
  );
}

function PaymentRow({ payment: p, tz, onResult }: { payment: Props["payments"][number]; tz: string; onResult: (r: ActionResult) => void }) {
  const [voiding, setVoiding] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className={`font-medium tabular ${p.voidedAt ? "text-cocoa-soft line-through" : ""}`}>{formatBRL(p.amountCents)}</span> · {p.method} ·{" "}
          {new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" }).format(new Date(p.paidAt))} {formatTime(new Date(p.paidAt), tz)}
        </span>
        {!p.voidedAt && !voiding && (
          <button type="button" className="min-h-9 text-[13px] font-medium text-danger underline underline-offset-4" onClick={() => setVoiding(true)}>
            Estornar
          </button>
        )}
      </div>
      {p.voidedAt && <p className="text-[13px] text-danger">Estornado: {p.voidReason}</p>}
      {voiding && (
        <form
          className="mt-2 flex gap-2"
          action={(f) =>
            start(async () => {
              const r = await voidPaymentAction(p.id, String(f.get("reason") ?? ""));
              onResult(r);
              if (r.ok) setVoiding(false);
            })
          }
        >
          <Input name="reason" placeholder="Motivo do estorno…" aria-label="Motivo do estorno" required minLength={3} className="min-h-10" />
          <SubmitButton variant="danger" size="sm" pending={pending}>
            Estornar
          </SubmitButton>
        </form>
      )}
    </li>
  );
}

function ReschedulePanel({ id, initialDate, tz, onDone, onClose }: { id: string; initialDate: string; tz: string; onDone: (r: ActionResult) => void; onClose: () => void }) {
  const [date, setDateRaw] = useState(initialDate);
  const [time, setTime] = useState("");
  const [outside, setOutside] = useState(false);
  const [pending, start] = useTransition();
  const slotsState = useAsync(`${id}#${date}`, () => rescheduleSlotsAction(id, date));
  const slots = slotsState.status === "ok" ? slotsState.data : slotsState.status === "error" ? [] : null;
  const setDate = (value: string) => {
    setDateRaw(value);
    setTime("");
  };

  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-shell p-4 ring-1 ring-nude">
      <p className="font-semibold">Novo horário</p>
      <Field label="Data" htmlFor="rdate">
        <Input id="rdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {outside ? (
        <Field label="Horário" htmlFor="rtime">
          <Input id="rtime" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      ) : slots === null ? (
        <p className="flex items-center gap-2 text-sm text-cocoa-soft">
          <Spinner /> Buscando horários…
        </p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-cocoa-soft">Sem horários livres nesta data.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Horários livres">
          {slots.map((s) => {
            const label = formatTime(new Date(s), tz);
            return (
              <button key={s} type="button" role="radio" aria-checked={time === label} onClick={() => setTime(label)} className={`min-h-11 rounded-xl text-sm tabular ${time === label ? "bg-rose-deep text-shell" : "bg-blush ring-1 ring-nude"}`}>
                {label}
              </button>
            );
          })}
        </div>
      )}
      <Checkbox label="Encaixe fora dos horários livres" checked={outside} onChange={(e) => { setOutside(e.target.checked); setTime(""); }} />
      <div className="flex gap-2">
        <Button disabled={!time || pending} aria-busy={pending} onClick={() => start(async () => onDone(await rescheduleAction(id, date, time, outside)))}>
          {pending && <Spinner />} Confirmar
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Voltar
        </Button>
      </div>
    </div>
  );
}

function NotesForm({ id, initial }: { id: string; initial: string }) {
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <Section title="Observações">
      <form action={(f) => start(async () => setState(await updateNotesAction(id, String(f.get("notes") ?? ""))))} className="space-y-2">
        <Textarea name="notes" defaultValue={initial} maxLength={1000} aria-label="Observações do atendimento" placeholder="Cor do esmalte, preferências…" />
        <FormMessage result={state} />
        <SubmitButton variant="secondary" pending={pending}>
          Salvar observação
        </SubmitButton>
      </form>
    </Section>
  );
}
