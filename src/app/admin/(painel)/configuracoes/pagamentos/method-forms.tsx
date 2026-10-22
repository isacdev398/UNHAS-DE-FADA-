"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { addPaymentMethodAction, togglePaymentMethodAction } from "../actions";

export function MethodForm() {
  const [state, action] = useActionState(addPaymentMethodAction, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <Input name="name" placeholder="Ex.: Vale-presente…" aria-label="Nome da forma de pagamento" maxLength={40} required className="min-h-11" />
        <SubmitButton variant="secondary">Adicionar</SubmitButton>
      </div>
      <FormMessage result={state} />
    </form>
  );
}

export function MethodToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={`${name}: ${optimistic ? "ativa" : "desligada"}`}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await togglePaymentMethodAction(id, !optimistic);
        })
      }
      className="flex min-h-12 min-w-12 items-center justify-center"
    >
      <span className={`relative h-7 w-12 rounded-full transition-colors ${optimistic ? "bg-sage" : "bg-nude"}`}>
        <span className={`absolute left-0 top-0.5 size-6 rounded-full bg-white shadow transition-transform ${optimistic ? "translate-x-5.5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}
