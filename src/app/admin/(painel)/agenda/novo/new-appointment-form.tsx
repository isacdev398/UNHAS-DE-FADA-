"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Spinner } from "@/components/ui/button";
import { useAsync } from "@/components/ui/use-async";
import { Checkbox, Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { IconCheck, IconSearch, IconX } from "@/components/ui/icons";
import type { ActionResult } from "@/lib/errors";
import { formatBRL, formatDuration, formatPhone } from "@/lib/format";
import { formatTime } from "@/lib/time";
import { createAppointmentAction, freeSlotsAction, searchClientsAction } from "../actions";

type Service = { id: string; name: string; priceCents: number; durationMinutes: number };
type Client = { id: string; name: string; phone: string };

export function NewAppointmentForm({
  services,
  initialDate,
  initialClient,
  tz,
}: {
  services: Service[];
  initialDate: string;
  initialClient?: Client | null;
  tz: string;
}) {
  const [client, setClient] = useState<Client | null>(initialClient ?? null);
  const [newClient, setNewClient] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelectedRaw] = useState<string[]>([]);
  const [date, setDateRaw] = useState(initialDate);
  const [time, setTime] = useState<string>("");
  const [outsideHours, setOutsideHours] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startSubmit] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);
  const search = useAsync(debounced.length >= 2 ? debounced : null, () => searchClientsAction(debounced));
  const results: Client[] = search.status === "ok" && term.trim().length >= 2 ? search.data : [];

  const slotsState = useAsync(selected.length && date ? `${selected.join(",")}#${date}` : null, () => freeSlotsAction(selected, date));
  const slots = slotsState.status === "ok" ? slotsState.data.slots : null;
  const loadingSlots = slotsState.status === "loading";

  // Trocar serviço ou data invalida o horário escolhido.
  const setSelected = (fn: (prev: string[]) => string[]) => {
    setSelectedRaw(fn);
    setTime("");
  };
  const setDate = (value: string) => {
    setDateRaw(value);
    setTime("");
  };

  const chosen = services.filter((s) => selected.includes(s.id));
  const total = chosen.reduce((s, x) => s + x.priceCents, 0);
  const duration = chosen.reduce((s, x) => s + x.durationMinutes, 0);

  function submit(form: FormData) {
    setResult(null);
    startSubmit(async () => {
      const r = await createAppointmentAction({
        serviceIds: selected,
        date,
        time,
        clientId: client?.id,
        clientName: newClient ? String(form.get("clientName") ?? "") : undefined,
        clientPhone: newClient ? String(form.get("clientPhone") ?? "") : undefined,
        notes: String(form.get("notes") ?? ""),
        outsideHours,
      });
      if (r) setResult(r);
    });
  }

  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;

  return (
    <form action={submit} className="space-y-6">
      {/* Cliente */}
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">Cliente</legend>
        {client ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-shell px-4 py-3 ring-2 ring-rose-deep">
            <div>
              <p className="font-medium">{client.name}</p>
              <p className="text-sm text-cocoa-soft">{formatPhone(client.phone)}</p>
            </div>
            <button type="button" onClick={() => setClient(null)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-nude-soft" aria-label="Trocar cliente">
              <IconX />
            </button>
          </div>
        ) : newClient ? (
          <div className="space-y-3 rounded-2xl bg-shell p-4 ring-1 ring-nude">
            <Field label="Nome" htmlFor="clientName" error={fieldErrors?.clientName}>
              <Input id="clientName" name="clientName" autoComplete="off" required />
            </Field>
            <Field label="WhatsApp" htmlFor="clientPhone" error={fieldErrors?.clientPhone}>
              <Input id="clientPhone" name="clientPhone" type="tel" inputMode="tel" placeholder="(86) 99999-9999" required />
            </Field>
            <button type="button" className="text-sm font-medium text-rose-deep underline underline-offset-4" onClick={() => setNewClient(false)}>
              Buscar cliente cadastrada
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cocoa-soft" size={18} />
              <Input
                aria-label="Buscar cliente por nome ou telefone"
                placeholder="Buscar por nome ou telefone…"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="pl-11"
                autoComplete="off"
              />
            </div>
            {results.length > 0 && (
              <ul className="divide-y divide-nude/70 overflow-hidden rounded-2xl bg-shell ring-1 ring-nude">
                {results.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => { setClient(c); setTerm(""); }} className="flex min-h-13 w-full items-center justify-between px-4 text-left hover:bg-nude-soft/60">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-sm text-cocoa-soft tabular">{formatPhone(c.phone)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="secondary" className="w-full" onClick={() => setNewClient(true)}>
              Cadastrar nova cliente
            </Button>
          </div>
        )}
      </fieldset>

      {/* Serviços */}
      <fieldset>
        <legend className="mb-2 font-semibold">Serviços</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => {
            const checked = selected.includes(s.id);
            return (
              <label key={s.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl px-4 py-2 ${checked ? "bg-shell ring-2 ring-rose-deep" : "bg-shell/70 ring-1 ring-nude"}`}>
                <input type="checkbox" className="size-5 accent-rose-deep" checked={checked} onChange={() => setSelected((p) => (checked ? p.filter((x) => x !== s.id) : [...p, s.id]))} />
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="text-right text-sm text-cocoa-soft tabular">
                  {formatBRL(s.priceCents)}
                  <br />
                  {formatDuration(s.durationMinutes)}
                </span>
              </label>
            );
          })}
        </div>
        {chosen.length > 0 && (
          <p className="mt-2 text-sm text-cocoa-soft tabular">
            Total: <strong className="text-cocoa">{formatBRL(total)}</strong> · {formatDuration(duration)} (promoções vigentes são aplicadas ao salvar)
          </p>
        )}
      </fieldset>

      {/* Data e horário */}
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">Data e horário</legend>
        <Field label="Data" htmlFor="date">
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        {selected.length === 0 ? (
          <p className="text-sm text-cocoa-soft">Escolha os serviços para ver os horários livres.</p>
        ) : outsideHours ? (
          <Field label="Horário do encaixe" htmlFor="time" hint="Fora dos horários livres. Ainda não pode sobrepor outro atendimento.">
            <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} step={300} required />
          </Field>
        ) : loadingSlots || slots === null ? (
          <p className="flex items-center gap-2 text-sm text-cocoa-soft">
            <Spinner /> Buscando horários…
          </p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-cocoa-soft">Sem horários livres nesta data.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Horários livres">
            {slots.map((s) => {
              const label = formatTime(new Date(s), tz);
              const active = time === label;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTime(label)}
                  className={`min-h-11 rounded-xl text-sm font-medium tabular ${active ? "bg-rose-deep text-shell" : "bg-shell ring-1 ring-nude"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {selected.length > 0 && (
          <Checkbox label="Encaixe fora dos horários livres" checked={outsideHours} onChange={(e) => { setOutsideHours(e.target.checked); setTime(""); }} />
        )}
      </fieldset>

      <Field label="Observação (opcional)" htmlFor="notes">
        <Textarea id="notes" name="notes" maxLength={1000} />
      </Field>

      <FormMessage result={result} />

      <Button type="submit" size="lg" className="w-full" disabled={pending || selected.length === 0 || !time || (!client && !newClient)} aria-busy={pending}>
        {pending ? <Spinner /> : <IconCheck />}
        Salvar agendamento
      </Button>
    </form>
  );
}
