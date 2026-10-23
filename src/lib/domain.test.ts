import { describe, expect, it } from "vitest";
import { computeAvailableDates, computeDaySlots, type AgendaState, type ScheduleRules } from "./availability";
import { outstanding, percentChange, periodRange, summarize } from "./finance";
import { formatBRL, normalizePhone, parseBRL } from "./format";
import { canClientCancel, canClientReschedule } from "./policy";
import { quote, promotionsValidOn, type ActivePromotion } from "./pricing";
import { addDays, formatTime, utcToZoned, weekdayOf, zonedToUtc } from "./time";
import { generateManageToken, hashToken, isWellFormedToken } from "./tokens";

const TZ = "America/Fortaleza"; // UTC-3, sem horário de verão

describe("time", () => {
  it("converte horário local para UTC", () => {
    expect(zonedToUtc("2030-01-08", 9 * 60, TZ).toISOString()).toBe("2030-01-08T12:00:00.000Z");
  });
  it("converte UTC para local", () => {
    expect(utcToZoned(new Date("2030-01-08T02:30:00Z"), TZ)).toEqual({ date: "2030-01-07", minutes: 23 * 60 + 30, weekday: 1 });
  });
  it("respeita horário de verão em fusos que têm", () => {
    // 2030-03-10: início do horário de verão em Nova York (UTC-5 → UTC-4)
    expect(zonedToUtc("2030-03-10", 12 * 60, "America/New_York").toISOString()).toBe("2030-03-10T16:00:00.000Z");
    expect(zonedToUtc("2030-03-09", 12 * 60, "America/New_York").toISOString()).toBe("2030-03-09T17:00:00.000Z");
  });
  it("calcula dias e dia da semana", () => {
    expect(addDays("2030-12-31", 1)).toBe("2031-01-01");
    expect(weekdayOf("2030-01-08")).toBe(2);
    expect(formatTime(new Date("2030-01-08T12:00:00Z"), TZ)).toBe("09:00");
  });
});

describe("pricing", () => {
  const mao = { id: "mao", name: "Mão", priceCents: 2000, durationMinutes: 45 };
  const pe = { id: "pe", name: "Pé", priceCents: 2000, durationMinutes: 50 };
  const spa = { id: "spa", name: "Spa", priceCents: 3333, durationMinutes: 30 };
  const promo = (p: Partial<ActivePromotion>): ActivePromotion => ({
    id: "p",
    title: "Promo",
    promoPriceCents: 3500,
    serviceIds: ["mao", "pe"],
    startsOn: "2030-01-01",
    endsOn: "2030-01-31",
    ...p,
  });

  it("soma preços e durações de vários serviços", () => {
    const q = quote([mao, pe], []);
    expect(q.totalCents).toBe(4000);
    expect(q.durationMinutes).toBe(95);
    expect(q.items).toHaveLength(2);
  });

  it("ignora serviço repetido", () => {
    expect(quote([mao, mao], []).totalCents).toBe(2000);
  });

  it("aplica promoção quando todos os serviços estão no pedido", () => {
    const q = quote([mao, pe], [promo({})]);
    expect(q.totalCents).toBe(3500);
    expect(q.listTotalCents).toBe(4000);
    expect(q.appliedPromotions).toEqual([{ id: "p", title: "Promo", savingCents: 500, endsOn: "2030-01-31" }]);
    expect(q.items.every((i) => i.promotionId === "p" && i.priceCents <= i.listPriceCents)).toBe(true);
  });

  it("não aplica promoção incompleta", () => {
    expect(quote([mao], [promo({})]).totalCents).toBe(2000);
  });

  it("não aplica promoção que deixaria mais caro", () => {
    expect(quote([mao, pe], [promo({ promoPriceCents: 5000 })]).totalCents).toBe(4000);
  });

  it("escolhe a promoção de maior economia sem reutilizar serviços", () => {
    const q = quote([mao, pe], [promo({ id: "a", promoPriceCents: 3800 }), promo({ id: "b", promoPriceCents: 3000, serviceIds: ["pe"] })]);
    // "b" cobra mais que o preço cheio do Pé, então não é aplicada
    expect(q.appliedPromotions.map((p) => p.id)).toEqual(["a"]);
    const q2 = quote([mao, pe], [promo({ id: "a", promoPriceCents: 3800 }), promo({ id: "c", promoPriceCents: 1000, serviceIds: ["pe"] })]);
    expect(q2.appliedPromotions.map((p) => p.id)).toEqual(["c"]);
    expect(q2.totalCents).toBe(3000);
  });

  it("reparte centavos sem passar do preço cheio e sem perder valor", () => {
    const q = quote([mao, spa], [promo({ serviceIds: ["mao", "spa"], promoPriceCents: 5001 })]);
    expect(q.totalCents).toBe(5001);
    for (const i of q.items) expect(i.priceCents).toBeLessThanOrEqual(i.listPriceCents);
  });

  it("filtra promoções pela data do atendimento", () => {
    const p = [promo({})];
    expect(promotionsValidOn(p, "2030-01-31")).toHaveLength(1);
    expect(promotionsValidOn(p, "2030-02-01")).toHaveLength(0);
  });
});

describe("availability", () => {
  const rules: ScheduleRules = { tz: TZ, intervalMinutes: 15, bufferMinutes: 0, minAdvanceMinutes: 60, maxAdvanceDays: 30 };
  const base: AgendaState = {
    weeklyHours: [
      { weekday: 2, opensAt: "08:00", closesAt: "12:00" },
      { weekday: 2, opensAt: "13:30", closesAt: "18:00" },
    ],
    exceptions: [],
    blocks: [],
    busy: [],
  };
  const now = new Date("2030-01-07T12:00:00Z"); // segunda 09:00 local
  const local = (date: string, hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return zonedToUtc(date, h * 60 + m, TZ);
  };
  const times = (slots: Date[]) => slots.map((s) => formatTime(s, TZ));

  it("gera horários dentro do expediente, respeitando o intervalo de almoço", () => {
    const slots = times(computeDaySlots("2030-01-08", 45, rules, base, now));
    expect(slots[0]).toBe("08:00");
    expect(slots).toContain("11:15");
    expect(slots).not.toContain("11:30"); // terminaria 12:15
    expect(slots).not.toContain("12:30");
    expect(slots).toContain("13:30");
    expect(slots.at(-1)).toBe("17:15");
  });

  it("dia sem expediente não tem horários", () => {
    expect(computeDaySlots("2030-01-09", 45, rules, base, now)).toEqual([]);
  });

  it("remove horários que conflitam com agendamentos", () => {
    const busy = [{ start: local("2030-01-08", "09:00"), end: local("2030-01-08", "10:00") }];
    const slots = times(computeDaySlots("2030-01-08", 45, rules, { ...base, busy }, now));
    expect(slots).toContain("08:15"); // termina 09:00
    expect(slots).not.toContain("08:30");
    expect(slots).not.toContain("09:45");
    expect(slots).toContain("10:00");
  });

  it("oferece o horário logo após o fim do atendimento anterior (durações variadas)", () => {
    // Pé de 50 min às 08:00 termina 08:50: a próxima cliente pode começar 08:50, sem esperar 09:00
    const busy = [{ start: local("2030-01-08", "08:00"), end: local("2030-01-08", "08:50") }];
    const slots = times(computeDaySlots("2030-01-08", 45, rules, { ...base, busy }, now));
    expect(slots).toContain("08:50");
    expect(slots).not.toContain("08:45");
    expect(slots).toContain("09:00"); // a grade continua disponível
  });

  it("oferece o horário que termina exatamente quando o próximo atendimento começa", () => {
    const busy = [{ start: local("2030-01-08", "10:10"), end: local("2030-01-08", "11:00") }];
    const slots = times(computeDaySlots("2030-01-08", 45, rules, { ...base, busy }, now));
    expect(slots).toContain("09:25"); // 09:25 + 45 min = 10:10
    expect(slots).not.toContain("09:30");
    expect(slots).toContain("11:00");
  });

  it("encaixa após um bloqueio que termina fora da grade", () => {
    const blocks = [{ start: local("2030-01-08", "13:30"), end: local("2030-01-08", "14:05") }];
    const slots = times(computeDaySlots("2030-01-08", 45, rules, { ...base, blocks }, now));
    expect(slots).toContain("14:05");
    expect(slots).not.toContain("14:00");
  });

  it("horário encaixado nunca sai do expediente", () => {
    // termina 11:40; um serviço de 45 min às 11:40 passaria do meio-dia
    const busy = [{ start: local("2030-01-08", "11:00"), end: local("2030-01-08", "11:40") }];
    const slots = times(computeDaySlots("2030-01-08", 45, rules, { ...base, busy }, now));
    expect(slots).not.toContain("11:40");
  });

  it("aplica intervalo extra entre atendimentos", () => {
    const busy = [{ start: local("2030-01-08", "09:00"), end: local("2030-01-08", "10:00") }];
    const slots = times(computeDaySlots("2030-01-08", 45, { ...rules, bufferMinutes: 15 }, { ...base, busy }, now));
    expect(slots).not.toContain("08:15");
    expect(slots).not.toContain("10:00");
    expect(slots).toContain("10:15");
  });

  it("respeita bloqueios", () => {
    const blocks = [{ start: local("2030-01-08", "00:00"), end: local("2030-01-09", "00:00") }];
    expect(computeDaySlots("2030-01-08", 45, rules, { ...base, blocks }, now)).toEqual([]);
  });

  it("horário excepcional substitui o semanal", () => {
    const exceptions = [{ onDate: "2030-01-09", opensAt: "10:00", closesAt: "11:00" }];
    expect(times(computeDaySlots("2030-01-09", 45, rules, { ...base, exceptions }, now))).toEqual(["10:00", "10:15"]);
  });

  it("respeita antecedência mínima e máxima", () => {
    const tuesdayNow = new Date("2030-01-08T13:00:00Z"); // terça 10:00 local
    const slots = times(computeDaySlots("2030-01-08", 45, rules, base, tuesdayNow));
    expect(slots[0]).toBe("11:00");
    expect(computeDaySlots("2030-03-05", 45, rules, base, now)).toEqual([]);
  });

  it("serviço longo demais não cabe no dia", () => {
    expect(computeDaySlots("2030-01-08", 300, rules, base, now)).toEqual([]);
  });

  it("lista só datas com horário livre", () => {
    const dates = computeAvailableDates(45, rules, base, now, 14);
    expect(dates).toEqual(["2030-01-08", "2030-01-15"]);
  });
});

describe("policy", () => {
  const policy = { allowClientCancel: true, cancelMinHours: 12, allowClientReschedule: false, rescheduleMinHours: 12 };
  const now = new Date("2030-01-07T12:00:00Z");
  it("permite cancelar com antecedência", () => {
    expect(canClientCancel(policy, new Date("2030-01-08T12:00:00Z"), now).allowed).toBe(true);
  });
  it("bloqueia cancelamento em cima da hora", () => {
    expect(canClientCancel(policy, new Date("2030-01-07T20:00:00Z"), now).allowed).toBe(false);
  });
  it("respeita reagendamento desativado", () => {
    expect(canClientReschedule(policy, new Date("2030-02-08T12:00:00Z"), now).allowed).toBe(false);
  });
});

describe("finance", () => {
  const appts = [
    { id: "a", status: "completed" as const, totalCents: 4000, items: [{ serviceId: "mp", name: "Mão e Pé", priceCents: 4000 }], startsAt: "" },
    { id: "b", status: "completed" as const, totalCents: 2000, items: [{ serviceId: "m", name: "Mão", priceCents: 2000 }], startsAt: "" },
    { id: "c", status: "confirmed" as const, totalCents: 2000, items: [{ serviceId: "m", name: "Mão", priceCents: 2000 }], startsAt: "" },
    { id: "d", status: "cancelled" as const, totalCents: 2000, items: [{ serviceId: "m", name: "Mão", priceCents: 2000 }], startsAt: "" },
  ];
  const payments = [
    { amountCents: 4000, methodName: "Pix", appointmentId: "a", voided: false },
    { amountCents: 2000, methodName: "Dinheiro", appointmentId: "b", voided: true },
    { amountCents: 500, methodName: "Dinheiro", appointmentId: "b", voided: false },
  ];

  it("separa previsto de recebido e ignora estornos e cancelados", () => {
    const s = summarize(appts, payments, [{ amountCents: 1000, voided: false }, { amountCents: 999, voided: true }]);
    expect(s.receivedCents).toBe(4500);
    expect(s.expectedCents).toBe(8000);
    expect(s.expensesCents).toBe(1000);
    expect(s.resultCents).toBe(3500);
    expect(s.completedCount).toBe(2);
    expect(s.averageTicketCents).toBe(3000);
    expect(s.byMethod).toEqual([{ name: "Pix", cents: 4000 }, { name: "Dinheiro", cents: 500 }]);
    expect(s.topServices[0].name).toBe("Mão e Pé");
  });

  it("lista pagamentos pendentes", () => {
    const due = outstanding(appts, payments);
    expect(due.map((d) => [d.id, d.dueCents])).toEqual([["b", 1500]]);
  });

  it("calcula períodos e comparação", () => {
    expect(periodRange("semana", "2030-01-09")).toEqual({ from: "2030-01-06", to: "2030-01-13", prevFrom: "2029-12-30", prevTo: "2030-01-06" });
    expect(periodRange("mes", "2030-03-15")).toEqual({ from: "2030-03-01", to: "2030-04-01", prevFrom: "2030-02-01", prevTo: "2030-03-01" });
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe("format", () => {
  it("interpreta valores em reais", () => {
    expect(parseBRL("20")).toBe(2000);
    expect(parseBRL("20,5")).toBe(2050);
    expect(parseBRL("R$ 1.234,56")).toBe(123456);
    expect(parseBRL("1.000")).toBe(100000);
    expect(parseBRL("abc")).toBeNull();
    expect(formatBRL(2000)).toMatch(/R\$\s20,00/);
  });
  it("normaliza telefone", () => {
    expect(normalizePhone("(86) 99459-8467")).toBe("5586994598467");
    expect(normalizePhone("+55 86 99459-8467")).toBe("5586994598467");
    expect(normalizePhone("8632221111")).toBe("558632221111");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("(86) 89459-8467")).toBeNull();
  });
});

describe("tokens", () => {
  it("gera tokens únicos e bem formados, guardando só o hash", () => {
    const a = generateManageToken();
    const b = generateManageToken();
    expect(a).not.toBe(b);
    expect(isWellFormedToken(a)).toBe(true);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(isWellFormedToken("5586994598467")).toBe(false);
  });
});
