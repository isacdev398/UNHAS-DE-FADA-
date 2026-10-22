"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/button";
import { useAsync } from "@/components/ui/use-async";
import { IconWhatsApp } from "@/components/ui/icons";
import { whatsappUrl } from "@/lib/format";
import { formatLocalDateLong, formatMonthShort, formatTime, formatWeekdayShort, utcToZoned } from "@/lib/time";

type Props = {
  /** Parâmetros da consulta: "servicos=id,id" ou "token=..." */
  query: string;
  tz: string;
  selected: string | null;
  onSelect: (iso: string | null) => void;
  whatsapp: string;
  /** Dia a mostrar primeiro (ex.: o mesmo dia depois de um horário ser ocupado) */
  initialDate?: string | null;
};

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Não foi possível carregar os horários.");
  return body;
}

export function SlotPicker({ query, tz, selected, onSelect, whatsapp, initialDate = null }: Props) {
  const [reload, setReload] = useState(0);
  const [chosenDate, setChosenDate] = useState<string | null>(selected ? utcToZoned(new Date(selected), tz).date : initialDate);
  const dates = useAsync<{ dates: string[] }>(`${query}#${reload}`, () => fetchJson(`/api/disponibilidade?${query}`));
  const dateList = dates.status === "ok" ? dates.data.dates : [];
  const date = chosenDate && dateList.includes(chosenDate) ? chosenDate : (dateList[0] ?? null);
  const slots = useAsync<{ slots: string[] }>(date ? `${query}#${date}#${reload}` : null, () =>
    fetchJson(`/api/disponibilidade?${query}&data=${date}`),
  );
  const setDate = setChosenDate;

  if (dates.status === "loading") {
    return (
      <p className="flex items-center gap-2 py-10 text-cocoa-soft" role="status">
        <Spinner /> Buscando horários livres…
      </p>
    );
  }
  if (dates.status === "error") {
    return (
      <div className="rounded-2xl bg-danger-soft p-4 text-danger" role="alert">
        <p className="font-medium">{dates.error}</p>
        <button type="button" className="mt-2 text-sm font-medium underline underline-offset-4" onClick={() => setReload((n) => n + 1)}>
          Tentar de novo
        </button>
      </div>
    );
  }
  if (dates.status !== "ok" || dateList.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-low p-6 text-center">
        <p className="font-display text-xl font-semibold text-cocoa">Sem horários livres no momento</p>
        <p className="mt-1 text-sm text-cocoa-soft">Chame a gente no WhatsApp que encontramos um horário para você.</p>
        <a href={whatsappUrl(whatsapp, "Olá! Não encontrei horário livre no site. Tem algum encaixe?")} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-sage px-5 text-sm font-semibold text-white">
          <IconWhatsApp /> Falar no WhatsApp
        </a>
      </div>
    );
  }

  const groups =
    slots.status === "ok"
      ? [
          { label: "Manhã", items: slots.data.slots.filter((s) => utcToZoned(new Date(s), tz).minutes < 12 * 60) },
          { label: "Tarde", items: slots.data.slots.filter((s) => { const m = utcToZoned(new Date(s), tz).minutes; return m >= 12 * 60 && m < 18 * 60; }) },
          { label: "Noite", items: slots.data.slots.filter((s) => utcToZoned(new Date(s), tz).minutes >= 18 * 60) },
        ].filter((g) => g.items.length > 0)
      : [];

  return (
    <div className="space-y-6">
      {/* min-w-0: fieldset cresce até o conteúdo por padrão e alargaria a página no celular */}
      <fieldset className="min-w-0">
        <legend className="label-caps mb-3 text-cocoa-soft">Escolha o dia</legend>
        <div className="scrollbar-none -mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-2">
          {dateList.map((d) => {
            const active = d === date;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setDate(d);
                  onSelect(null);
                }}
                className={`flex h-[84px] w-[68px] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl text-center transition-[background-color,color,box-shadow] ${
                  active ? "bg-rose-deep text-white shadow-cta" : "bg-shell text-cocoa shadow-soft hover:bg-nude-soft"
                }`}
              >
                <span className={`label-caps !text-[10px] ${active ? "text-petal-soft" : "text-outline"}`}>{formatWeekdayShort(d)}</span>
                <span className="font-display text-[26px] leading-none font-semibold tabular">{Number(d.slice(8))}</span>
                <span className={`text-[10px] font-semibold ${active ? "text-petal-soft" : "text-cocoa-soft"}`}>{formatMonthShort(d)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {date && (
        <fieldset className="rounded-2xl bg-nude-soft/60 p-4">
          <legend className="sr-only">Horários de {formatLocalDateLong(date)}</legend>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-cocoa first-letter:uppercase">{formatLocalDateLong(date)}</p>
            <p className="flex items-center gap-1.5 text-xs text-cocoa-soft">
              <span className="size-2 rounded-full bg-rose-deep" aria-hidden="true" /> Livres
            </p>
          </div>
          {slots.status === "loading" && (
            <p className="flex items-center gap-2 py-4 text-cocoa-soft" role="status">
              <Spinner /> Carregando…
            </p>
          )}
          {slots.status === "error" && <p className="text-danger" role="alert">{slots.error}</p>}
          {slots.status === "ok" && slots.data.slots.length === 0 && (
            <p className="text-cocoa-soft">Os horários deste dia acabaram de ser ocupados. Escolha outro dia.</p>
          )}
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="label-caps mb-2 text-outline">{g.label}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {g.items.map((s) => {
                    const active = s === selected;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSelect(s)}
                        className={`min-h-13 rounded-xl text-[15px] font-semibold tabular transition-[background-color,color,box-shadow] ${
                          active ? "bg-rose-deep text-white shadow-cta" : "bg-shell text-cocoa shadow-soft hover:bg-petal-soft/60"
                        }`}
                      >
                        {formatTime(new Date(s), tz)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
