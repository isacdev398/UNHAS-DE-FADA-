"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Spinner } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/errors";
import { formatPhone } from "@/lib/format";
import { anonymizeClientAction, createClientAction, updateClientAction } from "./actions";

export function ClientForm({ client }: { client?: { id: string; name: string; phone: string; notes: string } }) {
  const [state, action] = useActionState(client ? updateClientAction.bind(null, client.id) : createClientAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-shell p-4 ring-1 ring-nude">
      <Field label="Nome" htmlFor="name" error={errors?.name}>
        <Input id="name" name="name" defaultValue={client?.name} required maxLength={120} autoComplete="off" />
      </Field>
      <Field label="WhatsApp" htmlFor="phone" error={errors?.phone}>
        <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={client ? formatPhone(client.phone) : ""} required placeholder="(86) 99999-9999" />
      </Field>
      <Field label="Observações" htmlFor="notes" hint="Preferências, alergias, cores favoritas…">
        <Textarea id="notes" name="notes" defaultValue={client?.notes} maxLength={2000} />
      </Field>
      <FormMessage result={state} />
      <SubmitButton className="w-full">{client ? "Salvar dados" : "Cadastrar cliente"}</SubmitButton>
    </form>
  );
}

export function AnonymizeButton({ id }: { id: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <FormMessage result={result} />
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (confirm("Remover os dados pessoais desta cliente? Nome e telefone serão apagados e isso não pode ser desfeito. O histórico financeiro é mantido sem identificação.")) {
            start(async () => setResult(await anonymizeClientAction(id)));
          }
        }}
      >
        {pending && <Spinner />} Remover dados pessoais (LGPD)
      </Button>
    </div>
  );
}
