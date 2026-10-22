"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button, Spinner } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { IconPlus } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import type { SiteContent } from "@/lib/content";
import type { ActionResult } from "@/lib/errors";
import { formatPhone } from "@/lib/format";
import { discardDraftAction, publishAction, saveDraftAction, uploadPhotoAction } from "../actions";
import { optimize } from "../galeria/gallery-forms";

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

/** Escolhe uma foto da galeria ou envia uma nova (que também entra na galeria). */
function PhotoSelect({ name, label, value, photos }: { name: string; label: string; value: string; photos: Photo[] }) {
  const [current, setCurrent] = useState(value);
  const [uploaded, setUploaded] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const all = [...uploaded, ...photos];
  const selected = all.find((p) => p.path === current);

  function upload(file: File) {
    setError(null);
    startUpload(async () => {
      try {
        const { blob, width, height } = await optimize(file);
        const data = new FormData();
        data.set("file", new File([blob], `foto.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type }));
        data.set("alt", label.replace(/\s*\(opcional\)/i, ""));
        data.set("serviceId", "");
        data.set("width", String(width));
        data.set("height", String(height));
        const r = await uploadPhotoAction(null, data);
        if (!r.ok || !r.data) {
          setError(r.ok ? "Não foi possível enviar a foto." : r.error);
          return;
        }
        const photo = { path: r.data.path, url: r.data.url, alt: "Foto enviada agora" };
        setUploaded((u) => [photo, ...u]);
        setCurrent(photo.path);
      } catch {
        setError("Não foi possível ler esta foto. Tente outra (JPG ou PNG).");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  return (
    <Field label={label} htmlFor={name} error={error ?? undefined} hint="Envie uma foto do celular ou escolha uma da galeria.">
      <div className="flex items-center gap-3">
        {selected && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.url} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
        )}
        <Select id={name} name={name} value={current} onChange={(e) => setCurrent(e.target.value)} className="min-w-0 flex-1">
          <option value="">Sem foto</option>
          {all.map((p, i) => (
            <option key={p.path} value={p.path}>
              {p.alt || `Foto ${i + 1}`}
            </option>
          ))}
        </Select>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        id={`${name}-upload`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <Button variant="soft" size="sm" className="mt-2" disabled={uploading} aria-busy={uploading} onClick={() => fileRef.current?.click()}>
        {uploading ? <Spinner /> : <IconPlus size={15} />} {uploading ? "Enviando…" : "Enviar foto"}
      </Button>
    </Field>
  );
}
