"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { addCategoryAction, saveServiceAction, toggleServiceAction } from "./actions";

export function ActiveToggle({ id, active, label }: { id: string; active: boolean; label: string }) {
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={`${label}: ${optimistic ? "visível no site" : "oculto"}`}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleServiceAction(id, !optimistic);
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

type ServiceFormProps = {
  service?: {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    durationMinutes: number;
    categoryId: string | null;
    sort: number;
    active: boolean;
    featured: boolean;
    comboServiceIds: string[];
  };
  categories: { id: string; name: string }[];
  others: { id: string; name: string }[];
};

export function ServiceForm({ service, categories, others }: ServiceFormProps) {
  const [state, action] = useActionState(saveServiceAction.bind(null, service?.id ?? null), null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-shell p-4 ring-1 ring-nude">
      <Field label="Nome" htmlFor="name" error={errors?.name || undefined}>
        <Input id="name" name="name" defaultValue={service?.name} required maxLength={80} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço (R$)" htmlFor="price" error={errors?.price || undefined}>
          <Input id="price" name="price" inputMode="decimal" required defaultValue={service ? (service.priceCents / 100).toFixed(2).replace(".", ",") : ""} placeholder="20,00" />
        </Field>
        <Field label="Duração (min)" htmlFor="durationMinutes" error={errors?.durationMinutes || undefined}>
          <Input id="durationMinutes" name="durationMinutes" type="number" inputMode="numeric" min={5} max={600} step={5} required defaultValue={service?.durationMinutes ?? 45} />
        </Field>
      </div>
      <Field label="Descrição" htmlFor="description" hint="Aparece no site e no agendamento.">
        <Textarea id="description" name="description" defaultValue={service?.description} maxLength={600} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria" htmlFor="categoryId">
          <Select id="categoryId" name="categoryId" defaultValue={service?.categoryId ?? ""}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ordem no site" htmlFor="sort">
          <Input id="sort" name="sort" type="number" inputMode="numeric" min={0} max={999} defaultValue={service?.sort ?? 10} />
        </Field>
      </div>
      {others.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium">É um combo de… (opcional)</legend>
          <div className="mt-1 grid grid-cols-2">
            {others.map((o) => (
              <Checkbox key={o.id} name="comboServiceIds" value={o.id} defaultChecked={service?.comboServiceIds.includes(o.id)} label={o.name} />
            ))}
          </div>
        </fieldset>
      )}
      <div className="border-t border-nude pt-2">
        <Checkbox name="active" defaultChecked={service?.active ?? true} label="Visível no site e no agendamento" />
        <Checkbox name="featured" defaultChecked={service?.featured ?? false} label="Destaque" />
      </div>
      <FormMessage result={state} />
      <SubmitButton size="lg" className="w-full">
        {service ? "Salvar alterações" : "Criar serviço"}
      </SubmitButton>
    </form>
  );
}

export function CategoryForm() {
  const [state, action] = useActionState(addCategoryAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input name="name" placeholder="Nova categoria…" aria-label="Nome da nova categoria" maxLength={60} required className="min-h-11" />
        <SubmitButton variant="secondary">Criar</SubmitButton>
      </div>
      <FormMessage result={state} />
    </form>
  );
}
