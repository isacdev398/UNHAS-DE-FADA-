"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/errors";
import { createExpenseAction, voidExpenseAction } from "../actions";

const CATEGORIES = ["Materiais", "Esmaltes", "Aluguel", "Energia e água", "Internet e telefone", "Divulgação", "Impostos", "Geral"];

export function ExpenseForm({ today, methods }: { today: string; methods: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createExpenseAction, null);
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-shell p-4 ring-1 ring-nude">
      <Field label="Descrição" htmlFor="description">
        <Input id="description" name="description" required maxLength={120} placeholder="Ex.: lixas e algodão…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)" htmlFor="amount">
          <Input id="amount" name="amount" inputMode="decimal" required placeholder="0,00" />
        </Field>
        <Field label="Data" htmlFor="spentOn">
          <Input id="spentOn" name="spentOn" type="date" defaultValue={today} required />
        </Field>
        <Field label="Categoria" htmlFor="category">
          <Select id="category" name="category" defaultValue="Materiais">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Pago com" htmlFor="methodId">
          <Select id="methodId" name="methodId" defaultValue="">
            <option value="">—</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <FormMessage result={state} />
      <SubmitButton className="w-full">Registrar despesa</SubmitButton>
    </form>
  );
}

export function VoidExpense({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button type="button" className="mt-1 min-h-8 text-[13px] text-danger underline underline-offset-4" onClick={() => setOpen(true)}>
        Estornar
      </button>
    );
  }
  return (
    <form className="mt-2 space-y-2" action={(f) => start(async () => setResult(await voidExpenseAction(id, String(f.get("reason") ?? ""))))}>
      <div className="flex gap-2">
        <Input name="reason" required minLength={3} placeholder="Motivo do estorno…" aria-label="Motivo do estorno" className="min-h-10" />
        <SubmitButton variant="danger" size="sm" pending={pending}>
          Estornar
        </SubmitButton>
      </div>
      <FormMessage result={result} />
    </form>
  );
}
