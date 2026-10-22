"use client";

import { useActionState, useState, useTransition } from "react";
import { SlotPicker } from "@/components/site/slot-picker";
import { Button, Spinner } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { cancelByToken, rescheduleByToken, type ManageState } from "./actions";

export function ManageActions({
  token,
  tz,
  whatsapp,
  cancel,
  reschedule,
}: {
  token: string;
  tz: string;
  whatsapp: string;
  /** Motivo do bloqueio, ou null se permitido */
  cancel: string | null;
  reschedule: string | null;
}) {
  const [mode, setMode] = useState<"idle" | "reschedule" | "cancel">("idle");
  const [slot, setSlot] = useState<string | null>(null);
  const [rescheduleState, setRescheduleState] = useState<ManageState>(null);
  const [pending, startTransition] = useTransition();
  const [cancelState, cancelAction] = useActionState(cancelByToken.bind(null, token), null);

  if (mode === "reschedule") {
    return (
      <section className="space-y-4 rounded-3xl bg-shell p-5 ring-1 ring-nude" aria-labelledby="reagendar-titulo">
        <h2 id="reagendar-titulo" className="font-display text-3xl text-rose-ink">
          Novo horário
        </h2>
        <SlotPicker query={`token=${token}`} tz={tz} selected={slot} onSelect={setSlot} whatsapp={whatsapp} />
        <FormMessage result={rescheduleState} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            disabled={!slot || pending}
            aria-busy={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await rescheduleByToken(token, slot!);
                setRescheduleState(r);
                if (r?.ok) setMode("idle");
              })
            }
          >
            {pending && <Spinner />}
            Confirmar novo horário
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setMode("idle")}>
            Manter horário atual
          </Button>
        </div>
      </section>
    );
  }

  if (mode === "cancel") {
    return (
      <form action={cancelAction} className="space-y-4 rounded-3xl bg-shell p-5 ring-1 ring-nude">
        <h2 className="font-display text-3xl text-rose-ink">Cancelar agendamento?</h2>
        <p className="text-sm text-cocoa-soft">O horário fica livre para outra pessoa. Se quiser, conte o motivo.</p>
        <Field label="Motivo (opcional)" htmlFor="reason">
          <Input id="reason" name="reason" maxLength={300} placeholder="Ex.: imprevisto no trabalho…" />
        </Field>
        <FormMessage result={cancelState} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton variant="danger" size="lg">
            Sim, cancelar
          </SubmitButton>
          <Button variant="ghost" size="lg" onClick={() => setMode("idle")}>
            Voltar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <section className="space-y-3" aria-label="Alterar agendamento">
      <FormMessage result={rescheduleState ?? cancelState} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" size="lg" disabled={Boolean(reschedule)} onClick={() => setMode("reschedule")}>
          Reagendar
        </Button>
        <Button variant="danger" size="lg" disabled={Boolean(cancel)} onClick={() => setMode("cancel")}>
          Cancelar
        </Button>
      </div>
      {(reschedule || cancel) && <p className="text-sm text-cocoa-soft">{reschedule ?? cancel}</p>}
    </section>
  );
}
