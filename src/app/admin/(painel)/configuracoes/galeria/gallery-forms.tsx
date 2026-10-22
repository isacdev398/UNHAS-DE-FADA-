"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Spinner } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { IconChevronLeft, IconChevronRight, IconStar, IconTrash } from "@/components/ui/icons";
import type { ActionResult } from "@/lib/errors";
import { deletePhotoAction, updatePhotoAction, uploadPhotoAction } from "../actions";

const MAX_SIDE = 1600;

/** Reduz a foto no próprio celular antes de enviar (WebP, até 1600 px): envio rápido e site leve. */
async function optimize(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  // Safari antigo não gera WebP: usa JPEG.
  if (!blob || blob.type !== "image/webp") {
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!jpeg) throw new Error("Não foi possível processar a foto.");
    return { blob: jpeg, width, height };
  }
  return { blob, width, height };
}

export function PhotoUploader({ services }: { services: { id: string; name: string }[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(form: FormData) {
    setResult(null);
    start(async () => {
      const original = form.get("file");
      if (!(original instanceof File) || original.size === 0) {
        setResult({ ok: false, error: "Escolha uma foto." });
        return;
      }
      try {
        const { blob, width, height } = await optimize(original);
        const data = new FormData();
        data.set("file", new File([blob], `foto.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type }));
        data.set("alt", String(form.get("alt") ?? ""));
        data.set("serviceId", String(form.get("serviceId") ?? ""));
        data.set("width", String(width));
        data.set("height", String(height));
        const r = await uploadPhotoAction(null, data);
        setResult(r);
        if (r.ok) formRef.current?.reset();
      } catch {
        setResult({ ok: false, error: "Não foi possível ler esta foto. Tente outra." });
      }
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-3 rounded-2xl bg-shell p-4 ring-1 ring-nude">
      <Field label="Foto" htmlFor="file">
        <input id="file" name="file" type="file" accept="image/*" required className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-pill file:border-0 file:bg-nude-soft file:px-4 file:font-medium file:text-rose-ink" />
      </Field>
      <Field label="Descrição da foto" htmlFor="alt" hint="Ajuda quem usa leitor de tela. Ex.: unhas em nude com flores.">
        <Input id="alt" name="alt" maxLength={200} />
      </Field>
      <Field label="Serviço relacionado" htmlFor="serviceId">
        <Select id="serviceId" name="serviceId" defaultValue="">
          <option value="">Nenhum</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <FormMessage result={result} />
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending && <Spinner />} Enviar foto
      </Button>
    </form>
  );
}

type Photo = { id: string; url: string; alt: string; serviceId: string | null; featured: boolean; sort: number };

export function PhotoCard({ photo, services, prevSort, nextSort }: { photo: Photo; services: { id: string; name: string }[]; prevSort?: number; nextSort?: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : r.error);
    });

  return (
    <li className={`overflow-hidden rounded-2xl bg-shell ring-1 ${photo.featured ? "ring-2 ring-rose" : "ring-nude"} ${pending ? "opacity-60" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.alt} className="aspect-square w-full object-cover" loading="lazy" />
      <div className="space-y-2 p-2">
        <Select
          aria-label="Serviço relacionado"
          className="min-h-10 text-sm"
          defaultValue={photo.serviceId ?? ""}
          onChange={(e) => run(() => updatePhotoAction(photo.id, { serviceId: e.target.value || null }))}
        >
          <option value="">Sem serviço</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <div className="flex items-center justify-between">
          <button type="button" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-nude-soft disabled:opacity-30" disabled={prevSort === undefined} aria-label="Mover para antes" onClick={() => run(() => updatePhotoAction(photo.id, { sort: (prevSort ?? 0) - 1 }))}>
            <IconChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-pressed={photo.featured}
            aria-label={photo.featured ? "Tirar do destaque" : "Destacar"}
            onClick={() => run(() => updatePhotoAction(photo.id, { featured: !photo.featured }))}
            className={`inline-flex size-10 items-center justify-center rounded-full hover:bg-nude-soft ${photo.featured ? "text-rose" : "text-cocoa-soft"}`}
          >
            <IconStar size={18} fill={photo.featured ? "currentColor" : "none"} />
          </button>
          <button type="button" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-nude-soft disabled:opacity-30" disabled={nextSort === undefined} aria-label="Mover para depois" onClick={() => run(() => updatePhotoAction(photo.id, { sort: (nextSort ?? 0) + 1 }))}>
            <IconChevronRight size={18} />
          </button>
          <button type="button" className="inline-flex size-10 items-center justify-center rounded-full text-danger hover:bg-danger-soft" aria-label="Excluir foto" onClick={() => confirm("Excluir esta foto do site?") && run(() => deletePhotoAction(photo.id))}>
            <IconTrash size={18} />
          </button>
        </div>
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>
    </li>
  );
}
