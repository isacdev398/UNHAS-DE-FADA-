"use client";

import { useActionState, useState, useTransition } from "react";
import { Checkbox, Field, FormMessage, Input, Select } from "@/components/ui/form";
import { IconTrash } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { createBlockAction, deleteBlockAction } from "../actions";

export function BlockForm({ today }: { today: string }) {
  const [state, action] = useActionState(createBlockAction, null);
  const [allDay, setAllDay] = useState(true);
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-shell p-4 ring-1 ring-nude">
      <Field label="Tipo" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue="day_off">
          <option value="day_off">Folga</option>
          <option value="holiday">Feriado</option>
          <option value="vacation">Férias</option>
          <option value="break">Intervalo</option>
          <option value="block">Bloqueio de horário</option>
        </Select>
      </Field>
      <Checkbox name="allDay" label="Dia inteiro" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={allDay ? "De" : "Data"} htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" defaultValue={today} min={today} required />
        </Field>
        {allDay ? (
          <Field label="Até" htmlFor="endDate">
            <Input id="endDate" name="endDate" type="date" defaultValue={today} min={today} required />
          </Field>
        ) : (
          <input type="hidden" name="endDate" value="" />
        )}
      </div>
      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início" htmlFor="startTime">
            <Input id="startTime" name="startTime" type="time" step={300} required />
          </Field>
          <Field label="Fim" htmlFor="endTime">
            <Input id="endTime" name="endTime" type="time" step={300} required />
          </Field>
        </div>
      )}
      <Field label="Motivo (opcional)" htmlFor="reason">
        <Input id="reason" name="reason" maxLength={200} placeholder="Ex.: consulta médica…" />
      </Field>
      <FormMessage result={state} />
      <SubmitButton className="w-full">Salvar bloqueio</SubmitButton>
    </form>
  );
}

export function DeleteBlockButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Remover este bloqueio? O horário volta a ficar disponível.")) start(async () => void (await deleteBlockAction(id)));
      }}
      className="inline-flex size-11 items-center justify-center rounded-full text-danger hover:bg-danger-soft"
      aria-label="Remover bloqueio"
    >
      <IconTrash />
    </button>
  );
}
