"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Spinner } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select } from "@/components/ui/form";
import { IconPlus, IconTrash, IconX } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Settings } from "@/lib/data/agenda";
import type { ActionResult } from "@/lib/errors";
import { WEEKDAY_NAMES } from "@/lib/time";
import { addExceptionAction, deleteExceptionAction, saveRulesAction, saveWeeklyHoursAction } from "./actions";

type Range = { weekday: number; opensAt: string; closesAt: string };

export function WeeklyHoursEditor({ initial }: { initial: Range[] }) {
  const [ranges, setRanges] = useState<(Range & { key: number })[]>(initial.map((r, i) => ({ ...r, key: i })));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [nextKey, setNextKey] = useState(initial.length);

  const update = (key: number, patch: Partial<Range>) => setRanges((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (weekday: number) => {
    const last = ranges.filter((r) => r.weekday === weekday).at(-1);
    setRanges((rs) => [...rs, { weekday, opensAt: last ? last.closesAt : "08:00", closesAt: last ? "18:00" : "12:00", key: nextKey }]);
    setNextKey((k) => k + 1);
  };

  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const day = ranges.filter((r) => r.weekday === d).sort((a, b) => a.opensAt.localeCompare(b.opensAt));
        return (
          <div key={d} className="rounded-2xl bg-shell p-3 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="font-medium">{WEEKDAY_NAMES[d]}</p>
              {day.length === 0 && <span className="text-sm text-cocoa-soft">Fechado</span>}
            </div>
            <div className="mt-2 space-y-2">
              {day.map((r) => (
                <div key={r.key} className="flex items-center gap-2">
                  <Input type="time" step={300} value={r.opensAt} onChange={(e) => update(r.key, { opensAt: e.target.value })} aria-label={`${WEEKDAY_NAMES[d]}: início`} className="min-h-11" />
                  <span aria-hidden="true">–</span>
                  <Input type="time" step={300} value={r.closesAt} onChange={(e) => update(r.key, { closesAt: e.target.value })} aria-label={`${WEEKDAY_NAMES[d]}: fim`} className="min-h-11" />
                  <button type="button" onClick={() => setRanges((rs) => rs.filter((x) => x.key !== r.key))} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-cocoa-soft hover:bg-nude-soft" aria-label="Remover faixa">
                    <IconX size={18} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => add(d)} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-rose-deep">
                <IconPlus size={16} /> {day.length ? "Adicionar faixa" : "Abrir neste dia"}
              </button>
            </div>
          </div>
        );
      })}
      <FormMessage result={result} />
      <Button
        className="w-full"
        disabled={pending}
        aria-busy={pending}
        onClick={() => start(async () => setResult(await saveWeeklyHoursAction(ranges.map(({ weekday, opensAt, closesAt }) => ({ weekday, opensAt, closesAt })))))}
      >
        {pending && <Spinner />} Salvar horários
      </Button>
    </div>
  );
}

export function ExceptionForm() {
  const [state, action] = useActionState(addExceptionAction, null);
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-shell p-4 ring-1 ring-nude">
      <Field label="Data" htmlFor="onDate">
        <Input id="onDate" name="onDate" type="date" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Abre" htmlFor="opensAt">
          <Input id="opensAt" name="opensAt" type="time" step={300} required />
        </Field>
        <Field label="Fecha" htmlFor="closesAt">
          <Input id="closesAt" name="closesAt" type="time" step={300} required />
        </Field>
      </div>
      <Field label="Observação (opcional)" htmlFor="note">
        <Input id="note" name="note" maxLength={200} placeholder="Ex.: véspera de feriado…" />
      </Field>
      <FormMessage result={state} />
      <SubmitButton variant="secondary" className="w-full">
        Adicionar horário especial
      </SubmitButton>
    </form>
  );
}

export function DeleteExceptionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteExceptionAction(id)))} className="inline-flex size-11 items-center justify-center rounded-full text-danger hover:bg-danger-soft" aria-label="Remover horário especial">
      <IconTrash />
    </button>
  );
}

export function RulesForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState(saveRulesAction, null);
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-shell p-4 ring-1 ring-nude">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Horários a cada" htmlFor="slot_interval_minutes">
          <Select id="slot_interval_minutes" name="slot_interval_minutes" defaultValue={settings.intervalMinutes}>
            {[5, 10, 15, 20, 30, 60].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Folga entre clientes (min)" htmlFor="buffer_minutes">
          <Input id="buffer_minutes" name="buffer_minutes" type="number" inputMode="numeric" min={0} max={120} defaultValue={settings.bufferMinutes} />
        </Field>
        <Field label="Antecedência mínima (horas)" htmlFor="min_advance_hours">
          <Input id="min_advance_hours" name="min_advance_hours" type="number" inputMode="numeric" min={0} max={168} defaultValue={Math.round(settings.minAdvanceMinutes / 60)} />
        </Field>
        <Field label="Agenda aberta por (dias)" htmlFor="max_advance_days">
          <Input id="max_advance_days" name="max_advance_days" type="number" inputMode="numeric" min={1} max={365} defaultValue={settings.maxAdvanceDays} />
        </Field>
      </div>
      <div className="space-y-1 border-t border-nude pt-3">
        <Checkbox name="allow_client_cancel" defaultChecked={settings.allowClientCancel} label="Cliente pode cancelar pelo link" />
        <Field label="Até quantas horas antes" htmlFor="cancel_min_hours">
          <Input id="cancel_min_hours" name="cancel_min_hours" type="number" inputMode="numeric" min={0} max={336} defaultValue={settings.cancelMinHours} />
        </Field>
      </div>
      <div className="space-y-1 border-t border-nude pt-3">
        <Checkbox name="allow_client_reschedule" defaultChecked={settings.allowClientReschedule} label="Cliente pode reagendar pelo link" />
        <Field label="Até quantas horas antes" htmlFor="reschedule_min_hours">
          <Input id="reschedule_min_hours" name="reschedule_min_hours" type="number" inputMode="numeric" min={0} max={336} defaultValue={settings.rescheduleMinHours} />
        </Field>
      </div>
      <FormMessage result={state} />
      <SubmitButton className="w-full">Salvar regras</SubmitButton>
    </form>
  );
}
