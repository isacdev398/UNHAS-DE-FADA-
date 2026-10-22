"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatBRL } from "@/lib/format";
import { savePromotionAction, togglePromotionAction } from "../actions";

export function PromotionForm({ services, today, defaultEnd }: { services: { id: string; name: string; priceCents: number }[]; today: string; defaultEnd: string }) {
  const [state, action] = useActionState(savePromotionAction, null);
  const [selected, setSelected] = useState<string[]>([]);
  const full = services.filter((s) => selected.includes(s.id)).reduce((s, x) => s + x.priceCents, 0);
  const suggestedTitle = services.filter((s) => selected.includes(s.id)).map((s) => s.name).join(" + ");

  return (
    <form action={action} className="space-y-4 rounded-2xl bg-shell p-4 ring-1 ring-nude">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">1. Serviços da promoção</legend>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => {
            const on = selected.includes(s.id);
            return (
              <label key={s.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill px-4 text-[15px] ${on ? "bg-rose-deep text-shell" : "bg-blush ring-1 ring-nude"}`}>
                <input type="checkbox" name="serviceIds" value={s.id} checked={on} onChange={() => setSelected((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))} className="sr-only" />
                {s.name}
              </label>
            );
          })}
        </div>
        {full > 0 && <p className="mt-2 text-sm text-cocoa-soft">Preço normal: {formatBRL(full)}</p>}
      </fieldset>
      <Field label="2. Preço promocional (R$)" htmlFor="price">
        <Input id="price" name="price" inputMode="decimal" required placeholder="0,00" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="3. Começa em" htmlFor="startsOn">
          <Input id="startsOn" name="startsOn" type="date" defaultValue={today} required />
        </Field>
        <Field label="Termina em" htmlFor="endsOn">
          <Input id="endsOn" name="endsOn" type="date" defaultValue={defaultEnd} min={today} required />
        </Field>
      </div>
      <Field label="Nome da promoção" htmlFor="title">
        <Input key={suggestedTitle} id="title" name="title" defaultValue={suggestedTitle ? `Promoção ${suggestedTitle}` : ""} required maxLength={80} />
      </Field>
      <Field label="Descrição (opcional)" htmlFor="description">
        <Input id="description" name="description" maxLength={400} />
      </Field>
      <FormMessage result={state} />
      <SubmitButton size="lg" className="w-full" disabled={selected.length === 0}>
        Criar promoção
      </SubmitButton>
    </form>
  );
}

export function PromotionToggle({ id, active, title }: { id: string; active: boolean; title: string }) {
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={`${title}: ${optimistic ? "ativa" : "pausada"}`}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await togglePromotionAction(id, !optimistic);
        })
      }
      className="flex min-h-11 min-w-11 items-center justify-center"
    >
      <span className={`relative h-7 w-12 rounded-full transition-colors ${optimistic ? "bg-sage" : "bg-nude"}`}>
        <span className={`absolute left-0 top-0.5 size-6 rounded-full bg-white shadow transition-transform ${optimistic ? "translate-x-5.5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}
