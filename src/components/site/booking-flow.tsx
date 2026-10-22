"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { confirmBooking, type BookingState } from "@/app/(site)/agendar/actions";
import { track } from "@/components/site/analytics";
import { SlotPicker } from "@/components/site/slot-picker";
import { Button, Spinner } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { IconCalendar, IconCheck, IconChevronLeft, IconClock, IconLock, IconPlus, IconSparkle, IconUsers, IconWhatsApp } from "@/components/ui/icons";
import type { BookingPolicy, Catalog, CatalogService } from "@/lib/data/public";
import { formatBRL, formatDuration } from "@/lib/format";
import { promotionsValidOn, quote } from "@/lib/pricing";
import { DEFAULT_TZ, formatDateTime, formatLocalDateShort, todayIn, utcToZoned } from "@/lib/time";

type Step = 1 | 2 | 3;

/** Título numerado de cada etapa, como nas referências */
function SectionTitle({ n, title, aside }: { n: number; title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 font-display text-[22px] leading-[30px] font-semibold text-cocoa">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-petal-soft font-sans text-[13px] font-bold text-rose-deep">{n}</span>
        {title}
      </h2>
      {aside}
    </div>
  );
}

export function BookingFlow({
  catalog,
  whatsapp,
  policy,
  photos,
}: {
  catalog: Catalog;
  whatsapp: string;
  policy: BookingPolicy;
  /** Foto da galeria para cada serviço (miniatura no cartão) */
  photos: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tz = DEFAULT_TZ;

  const bySlug = useMemo(() => new Map(catalog.services.map((s) => [s.slug, s])), [catalog.services]);
  const byId = useMemo(() => new Map(catalog.services.map((s) => [s.id, s])), [catalog.services]);

  const [selected, setSelected] = useState<string[]>(() =>
    (searchParams.get("servico") ?? "")
      .split(",")
      .map((slug) => bySlug.get(slug)?.id)
      .filter((id): id is string => Boolean(id)),
  );
  const [step, setStep] = useState<Step>(1);
  const [slot, setSlot] = useState<string | null>(null);
  const [state, setState] = useState<BookingState>(null);
  const [pending, startTransition] = useTransition();
  const [slotKey, setSlotKey] = useState(0);
  const [retryDate, setRetryDate] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const started = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // A URL guarda os serviços escolhidos: o link pode ser compartilhado.
  useEffect(() => {
    const slugs = selected.map((id) => byId.get(id)?.slug).filter(Boolean).join(",");
    const params = new URLSearchParams(searchParams.toString());
    if (slugs) params.set("servico", slugs);
    else params.delete("servico");
    const next = params.toString();
    if (next !== searchParams.toString()) router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
  }, [selected, byId, pathname, router, searchParams]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const today = todayIn(tz);
  const slotDate = slot ? utcToZoned(new Date(slot), tz).date : today;
  const selectedServices = selected.map((id) => byId.get(id)).filter((s): s is CatalogService => Boolean(s));
  const q = quote(selectedServices, promotionsValidOn(catalog.promotions, slotDate));

  // Serviços que já fazem parte de um combo escolhido (e vice-versa) não podem ser somados.
  const blocked = new Set<string>();
  for (const s of selectedServices) {
    for (const id of s.comboServiceIds) blocked.add(id);
    for (const other of catalog.services) if (other.comboServiceIds.includes(s.id)) blocked.add(other.id);
  }

  const suggestions = catalog.services.filter(
    (s) =>
      !selected.includes(s.id) &&
      !blocked.has(s.id) &&
      !s.isCombo &&
      selectedServices.some((sel) => catalog.services.some((c) => c.comboServiceIds.includes(sel.id) && c.comboServiceIds.includes(s.id))),
  );

  function toggle(id: string) {
    setSlot(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function goToSchedule() {
    if (!started.current) {
      track("booking_start");
      started.current = true;
    }
    setStep(2);
  }

  function submit(form: FormData) {
    setState(null);
    startTransition(async () => {
      const result = await confirmBooking({
        serviceIds: selected,
        startsAt: slot,
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        privacy: form.get("privacy") === "on",
        website: String(form.get("website") ?? ""),
      });
      if (result?.code === "slot") {
        // Volta para o mesmo dia, já com os horários atualizados.
        if (slot) setRetryDate(utcToZoned(new Date(slot), tz).date);
        setSlot(null);
        setSlotKey((k) => k + 1);
        setStep(2);
      } else if (result?.code === "services") {
        router.refresh();
        setStep(1);
      }
      if (result) setState(result);
    });
  }

  const categoryList = catalog.categories.filter((c) => catalog.services.some((s) => s.categoryId === c.id));
  const visibleServices = category ? catalog.services.filter((s) => s.categoryId === category) : catalog.services;

  const stepTitles: Record<Step, string> = { 1: "Serviços", 2: "Data", 3: "Você" };
  const stepIcons: Record<Step, typeof IconSparkle> = { 1: IconSparkle, 2: IconCalendar, 3: IconUsers };

  // A barra fixa fica acima da navegação inferior do site no celular.
  const dock = "fixed inset-x-0 z-30 bottom-[calc(4rem+var(--safe-bottom))] md:bottom-0";

  return (
    <div className="relative">
      <div className="glow -right-20 -top-20 size-64 bg-petal/35" aria-hidden="true" />

      <div className="relative">
        <p className="label-caps flex items-center gap-1.5 text-rose-deep">
          <IconSparkle size={15} /> Agendamento online
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-[34px] leading-[42px] font-semibold text-cocoa outline-none md:text-[44px] md:leading-[52px]">
          Agende seu <em className="italic text-rose-deep">momento</em>
        </h1>
        <p className="mt-1 text-[15px] text-cocoa-soft">Sem senha e sem cadastro. Escolha os serviços e veja os horários livres.</p>
      </div>

      {/* Etapas */}
      <nav aria-label="Etapas do agendamento" className="relative mt-5">
        <ol className="flex gap-1 rounded-2xl bg-nude-soft p-1">
          {([1, 2, 3] as Step[]).map((n) => {
            const Icon = stepIcons[n];
            const active = n === step;
            const done = n < step;
            return (
              <li key={n} className="flex-1">
                <button
                  type="button"
                  disabled={n > step}
                  onClick={() => setStep(n)}
                  aria-current={active ? "step" : undefined}
                  className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-[background-color,color,box-shadow] ${
                    active ? "bg-rose-deep text-white shadow-cta" : done ? "text-rose-deep" : "text-cocoa-soft"
                  }`}
                >
                  {done ? <IconCheck size={15} strokeWidth={2.4} /> : <Icon size={15} />}
                  {n}. {stepTitles[n]}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Resumo da sessão */}
      <div className="relative mt-4 flex items-center gap-4 rounded-2xl bg-shell p-4 shadow-soft" aria-live="polite">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-nude-soft text-rose-deep">
          <IconClock size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-caps text-outline">Sessão estimada</p>
          <p className="font-semibold text-cocoa tabular">{selected.length ? formatDuration(q.durationMinutes) : "—"}</p>
        </div>
        <div className="border-l border-nude pl-4 text-right">
          <p className="label-caps text-outline">Valor total</p>
          <p className="font-display text-lg font-bold text-rose-deep tabular">
            {q.listTotalCents > q.totalCents && <s className="mr-1.5 font-sans text-xs font-normal text-outline">{formatBRL(q.listTotalCents)}</s>}
            {formatBRL(q.totalCents)}
          </p>
        </div>
      </div>
      {q.appliedPromotions[0] && (
        <p className="mt-2 text-center text-xs font-semibold text-rose-deep">
          Preço promocional para atendimentos até {formatLocalDateShort(q.appliedPromotions[0].endsOn)}
        </p>
      )}

      {state?.error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {state.error}
        </p>
      )}

      {/* Etapa 1 — serviços */}
      {step === 1 && (
        <section className="mt-7" aria-label="Escolha os serviços">
          <SectionTitle
            n={1}
            title="Escolha os serviços"
            aside={selected.length > 0 && <span className="label-caps text-rose-deep">{selected.length} selecionado{selected.length > 1 ? "s" : ""}</span>}
          />
          {categoryList.length > 1 && (
            <div className="scrollbar-none -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Filtrar por categoria">
              {[{ id: null as string | null, name: "Todos" }, ...categoryList.map((c) => ({ id: c.id as string | null, name: c.name }))].map((c) => {
                const active = c.id === category;
                return (
                  <button
                    key={c.id ?? "todos"}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(c.id)}
                    className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-[background-color,color,box-shadow] ${
                      active ? "bg-rose-deep text-white shadow-cta" : "bg-champagne/60 text-cocoa ring-1 ring-inset ring-antique/20"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {catalog.services.length === 0 && <p className="text-cocoa-soft">Nenhum serviço disponível para agendamento no momento.</p>}
          <div className="space-y-3">
            {visibleServices.map((s) => {
              const checked = selected.includes(s.id);
              const disabled = !checked && blocked.has(s.id);
              const photo = photos[s.id];
              return (
                <label
                  key={s.id}
                  className={`relative flex cursor-pointer items-center gap-3.5 rounded-2xl p-3 transition-[background-color,box-shadow] ${
                    checked ? "bg-nude-soft shadow-soft ring-2 ring-rose-deep" : "bg-shell shadow-soft hover:shadow-lift"
                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={() => toggle(s.id)} />
                  <span className="relative size-[72px] shrink-0 overflow-hidden rounded-xl bg-nude-soft">
                    {photo ? (
                      <Image src={photo} alt="" fill sizes="72px" className="object-cover" />
                    ) : (
                      <Image src="/brand/monogram.png" alt="" width={60} height={46} className="absolute inset-0 m-auto h-9 w-auto opacity-80" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug font-semibold text-cocoa">{s.name}</span>
                    {s.description && <span className="mt-0.5 block line-clamp-1 text-[13px] text-cocoa-soft">{s.description}</span>}
                    {disabled ? (
                      <span className="mt-1 block text-xs text-cocoa-soft">{s.isCombo ? "Inclui um serviço que você já escolheu" : "Já faz parte do combo escolhido"}</span>
                    ) : (
                      <span className="mt-1.5 flex items-center gap-3 text-[13px]">
                        <span className="flex items-center gap-1 text-cocoa-soft">
                          <IconClock size={14} /> {formatDuration(s.durationMinutes)}
                        </span>
                        <span className="font-bold text-rose-deep tabular">{formatBRL(s.priceCents)}</span>
                      </span>
                    )}
                  </span>
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center self-start rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-rose-deep ${
                      checked ? "bg-rose-deep text-white" : "bg-petal-soft/70"
                    }`}
                    aria-hidden="true"
                  >
                    {checked && <IconCheck size={16} strokeWidth={2.6} />}
                  </span>
                </label>
              );
            })}
          </div>

          {suggestions.length > 0 && (
            <div className="mt-4 rounded-2xl bg-surface-low p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-rose-deep">
                <IconSparkle size={16} /> Aproveite o mesmo horário
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-shell px-4 text-[13px] font-semibold text-rose-deep shadow-soft"
                  >
                    <IconPlus size={15} /> Incluir {s.name} · {formatBRL(s.priceCents)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Etapa 2 — data e horário */}
      {step === 2 && (
        <section className="mt-7" aria-label="Escolha a data e o horário">
          <SectionTitle n={2} title="Data e horário disponível" />
          <p className="-mt-1 mb-4 text-[13px] text-cocoa-soft">Só aparecem os horários realmente livres, atualizados agora.</p>
          <SlotPicker
            key={slotKey}
            query={`servicos=${selected.join(",")}`}
            tz={tz}
            selected={slot}
            onSelect={setSlot}
            whatsapp={whatsapp}
            initialDate={retryDate}
          />
        </section>
      )}

      {/* Etapa 3 — dados e resumo */}
      {step === 3 && slot && (
        <form action={submit} className="mt-7 space-y-7" noValidate>
          <section aria-label="Seus dados">
            <SectionTitle n={3} title="Seus dados" />
            <p className="-mt-1 mb-4 text-[13px] text-cocoa-soft">Sem senha. Você recebe um link para consultar, reagendar ou cancelar.</p>
            <div className="space-y-4 rounded-2xl bg-shell p-4 shadow-soft">
              <Field label="Nome completo" htmlFor="name" error={state?.fieldErrors?.name}>
                <Input id="name" name="name" autoComplete="name" required maxLength={80} placeholder="Como gosta de ser chamada?" aria-invalid={Boolean(state?.fieldErrors?.name)} />
              </Field>
              <Field label="WhatsApp com DDD" htmlFor="phone" error={state?.fieldErrors?.phone} hint="Usado só para falar sobre o seu agendamento.">
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  required
                  placeholder="(86) 99999-9999"
                  aria-invalid={Boolean(state?.fieldErrors?.phone)}
                />
              </Field>
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <label htmlFor="website">Não preencha</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
            </div>
          </section>

          <section aria-label="Resumo">
            <SectionTitle n={4} title="Resumo" />
            <div className="space-y-4 rounded-2xl bg-nude-soft p-4">
              <div>
                <p className="label-caps text-cocoa-soft">Serviços</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {q.items.map((i) => (
                    <li key={i.serviceId} className="flex justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-rose-deep" aria-hidden="true" /> {i.name}
                      </span>
                      <span className="font-semibold tabular">{formatBRL(i.priceCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-antique/25 pt-3 text-sm">
                <span className="flex items-center gap-2 font-semibold text-cocoa first-letter:uppercase">
                  <IconCalendar size={17} className="shrink-0 text-rose-deep" />
                  <span className="first-letter:uppercase">{formatDateTime(new Date(slot), tz)}</span>
                </span>
              </div>
              <div className="flex justify-between gap-3 border-t border-antique/25 pt-3 font-semibold">
                <span>Total · {formatDuration(q.durationMinutes)}</span>
                <span className="font-display text-lg text-rose-deep tabular">{formatBRL(q.totalCents)}</span>
              </div>

              <div className="flex gap-3 rounded-xl bg-shell p-3">
                <IconLock size={18} className="mt-0.5 shrink-0 text-rose-deep" />
                <div className="text-[13px] text-cocoa-soft">
                  <p className="font-semibold text-cocoa">Cancelamento e reagendamento</p>
                  {policy.allowClientCancel || policy.allowClientReschedule ? (
                    <p>
                      Imprevistos acontecem: pelo seu link, você pode {policy.allowClientReschedule ? "reagendar" : ""}
                      {policy.allowClientCancel && policy.allowClientReschedule ? " ou " : ""}
                      {policy.allowClientCancel ? "cancelar" : ""} até{" "}
                      <strong className="text-cocoa">{Math.max(policy.cancelMinHours, policy.rescheduleMinHours)}&nbsp;h antes</strong>.
                    </p>
                  ) : (
                    <p>Para alterar o horário, fale com a gente pelo WhatsApp.</p>
                  )}
                </div>
              </div>
              <p className="text-[13px] text-cocoa-soft">Pagamento no local, depois do atendimento: dinheiro, Pix ou cartão.</p>
            </div>
          </section>

          <div>
            <Checkbox
              name="privacy"
              label={
                <>
                  Li e concordo com a{" "}
                  <Link href="/privacidade" target="_blank" className="font-semibold text-rose-deep underline underline-offset-4">
                    política de privacidade
                  </Link>
                  .
                </>
              }
            />
            {state?.fieldErrors?.privacy && <p className="text-[13px] font-semibold text-danger">{state.fieldErrors.privacy}</p>}
          </div>

          <div className={`${dock} bg-blush/90 px-5 pt-3 backdrop-blur-xl`} style={{ paddingBottom: "0.75rem" }}>
            <div className="mx-auto max-w-2xl">
              <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
                {pending ? <Spinner /> : <IconCheck size={18} />}
                Confirmar meu agendamento
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Barra de avanço (etapas 1 e 2) */}
      {step < 3 && (
        <div className={`${dock} bg-blush/90 px-5 pt-3 backdrop-blur-xl`} style={{ paddingBottom: "0.75rem" }}>
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-high text-rose-deep"
                aria-label="Voltar para os serviços"
              >
                <IconChevronLeft />
              </button>
            )}
            {step === 1 ? (
              <Button size="lg" className="w-full" disabled={selected.length === 0} onClick={goToSchedule}>
                {selected.length === 0 ? "Escolha um ou mais serviços" : `Ver horários · ${formatBRL(q.totalCents)}`}
              </Button>
            ) : (
              <Button size="lg" className="w-full" disabled={!slot} onClick={() => setStep(3)}>
                {slot ? "Continuar" : "Escolha um horário"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Ajuda */}
      <p className="mt-8 text-center text-[13px] text-cocoa-soft">
        Ficou alguma dúvida?{" "}
        <a href={`https://wa.me/${whatsapp}`} className="inline-flex items-center gap-1 font-semibold text-rose-deep underline underline-offset-4">
          <IconWhatsApp size={14} /> Fale com a gente
        </a>
      </p>
    </div>
  );
}
