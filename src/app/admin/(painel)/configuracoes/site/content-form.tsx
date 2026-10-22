"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Spinner } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import type { SiteContent } from "@/lib/content";
import type { ActionResult } from "@/lib/errors";
import { formatPhone } from "@/lib/format";
import { discardDraftAction, publishAction, saveDraftAction } from "../actions";

type Photo = { path: string; url: string; alt: string };

export function ContentForm({ content, hasChanges, photos }: { content: SiteContent; hasChanges: boolean; photos: Photo[] }) {
  const [state, action] = useActionState(saveDraftAction, null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const e = (k: keyof SiteContent) => (state && !state.ok ? state.fieldErrors?.[k] || undefined : undefined);

  return (
    <div className="space-y-4">
      {hasChanges && (
        <div className="rounded-2xl bg-amber-soft p-4 text-sm text-amber">
          <p className="font-semibold">Há alterações não publicadas.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/admin/previa" className="inline-flex min-h-10 items-center rounded-pill bg-shell px-4 font-medium text-rose-ink ring-1 ring-nude">
              Ver pré-visualização
            </a>
            <Button size="sm" disabled={pending} onClick={() => start(async () => setResult(await publishAction()))}>
              {pending && <Spinner />} Publicar agora
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm("Descartar o rascunho?") && start(async () => setResult(await discardDraftAction()))}>
              Descartar
            </Button>
          </div>
        </div>
      )}
      <FormMessage result={result} />

      <form action={action} className="space-y-4 rounded-2xl bg-shell p-4 ring-1 ring-nude">
        <h2 className="font-semibold">Abertura</h2>
        <Field label="Título principal" htmlFor="heroTitle" error={e("heroTitle")} hint={<>Coloque uma palavra entre *asteriscos* para destacá-la em itálico. Ex.: do *jeitinho* que você gosta</>}>
          <Input id="heroTitle" name="heroTitle" defaultValue={content.heroTitle} maxLength={90} required />
        </Field>
        <Field label="Texto de apoio" htmlFor="heroSubtitle">
          <Textarea id="heroSubtitle" name="heroSubtitle" defaultValue={content.heroSubtitle} maxLength={240} />
        </Field>
        <PhotoSelect name="heroImagePath" label="Foto de capa (opcional)" value={content.heroImagePath} photos={photos} />

        <h2 className="border-t border-nude pt-4 font-semibold">Sobre</h2>
        <Field label="Título" htmlFor="aboutTitle">
          <Input id="aboutTitle" name="aboutTitle" defaultValue={content.aboutTitle} maxLength={60} />
        </Field>
        <Field label="Texto" htmlFor="about">
          <Textarea id="about" name="about" defaultValue={content.about} maxLength={1200} className="min-h-32" />
        </Field>
        <PhotoSelect name="aboutImagePath" label="Foto do espaço (opcional)" value={content.aboutImagePath} photos={photos} />

        <h2 className="border-t border-nude pt-4 font-semibold">Contato</h2>
        <Field label="WhatsApp" htmlFor="whatsapp" error={e("whatsapp")}>
          <Input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" defaultValue={formatPhone(content.whatsapp)} required />
        </Field>
        <Field label="Instagram" htmlFor="instagram" error={e("instagram")} hint="Só o usuário, ex.: unhasdefada">
          <Input id="instagram" name="instagram" defaultValue={content.instagram} spellCheck={false} autoCapitalize="none" />
        </Field>
        <Field label="Endereço" htmlFor="address">
          <Input id="address" name="address" defaultValue={content.address} maxLength={160} />
        </Field>
        <Field label="Cidade" htmlFor="city">
          <Input id="city" name="city" defaultValue={content.city} maxLength={80} placeholder="Ex.: Teresina – PI" />
        </Field>
        <Field label="Link do Google Maps (opcional)" htmlFor="mapsUrl" error={e("mapsUrl")}>
          <Input id="mapsUrl" name="mapsUrl" type="url" defaultValue={content.mapsUrl} spellCheck={false} />
        </Field>
        <Field label="Recado sobre horários (opcional)" htmlFor="hoursNote" hint="Ex.: Atendimento de terça a sábado, com hora marcada.">
          <Input id="hoursNote" name="hoursNote" defaultValue={content.hoursNote} maxLength={160} />
        </Field>

        <FormMessage result={state} />
        <div className="grid gap-2 sm:grid-cols-2">
          <SubmitButton name="intent" value="preview" size="lg">
            Salvar e pré-visualizar
          </SubmitButton>
          <SubmitButton name="intent" value="save" variant="secondary" size="lg">
            Só salvar rascunho
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

function PhotoSelect({ name, label, value, photos }: { name: string; label: string; value: string; photos: Photo[] }) {
  const [current, setCurrent] = useState(value);
  const selected = photos.find((p) => p.path === current);
  return (
    <Field label={label} htmlFor={name} hint={photos.length ? "Escolha entre as fotos da galeria." : "Envie fotos na Galeria para usar aqui."}>
      <div className="flex items-center gap-3">
        {selected && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.url} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
        )}
        <Select id={name} name={name} value={current} onChange={(e) => setCurrent(e.target.value)}>
          <option value="">Sem foto</option>
          {photos.map((p, i) => (
            <option key={p.path} value={p.path}>
              {p.alt || `Foto ${i + 1}`}
            </option>
          ))}
        </Select>
      </div>
    </Field>
  );
}
