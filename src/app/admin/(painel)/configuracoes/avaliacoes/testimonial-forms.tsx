"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { createTestimonialAction, deleteTestimonialAction, toggleTestimonialAction } from "../actions";

export function TestimonialForm() {
  const [state, action] = useActionState(createTestimonialAction, null);
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-shell p-4 ring-1 ring-nude">
      <Field label="Nome da cliente (como vai aparecer)" htmlFor="authorName">
        <Input id="authorName" name="authorName" maxLength={60} required placeholder="Ex.: Ana S." />
      </Field>
      <Field label="O que ela disse" htmlFor="body">
        <Textarea id="body" name="body" maxLength={600} required />
      </Field>
      <Field label="Nota (opcional)" htmlFor="rating">
        <Select id="rating" name="rating" defaultValue="">
          <option value="">Sem nota</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} estrela{n > 1 ? "s" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Checkbox name="consent" required label="A cliente autorizou a publicação desta avaliação." />
      <FormMessage result={state} />
      <SubmitButton className="w-full">Publicar avaliação</SubmitButton>
    </form>
  );
}

export function TestimonialRow({ t }: { t: { id: string; authorName: string; body: string; rating: number | null; published: boolean } }) {
  const [pending, start] = useTransition();
  return (
    <li className={`space-y-2 px-4 py-3 ${pending ? "opacity-60" : ""}`}>
      <p className="text-[15px]">“{t.body}”</p>
      <p className="text-sm text-cocoa-soft">
        {t.authorName}
        {t.rating && ` · ${t.rating}★`} · {t.published ? "Publicada" : "Oculta"}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => void (await toggleTestimonialAction(t.id, !t.published)))}>
          {t.published ? "Ocultar" : "Publicar"}
        </Button>
        <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => confirm("Excluir esta avaliação?") && start(async () => void (await deleteTestimonialAction(t.id)))}>
          Excluir
        </Button>
      </div>
    </li>
  );
}
