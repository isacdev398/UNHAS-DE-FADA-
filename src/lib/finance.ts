import { addDays, daysInMonth, startOfMonth, startOfWeek } from "./time";

export type FinanceAppointment = {
  id: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  totalCents: number;
  items: { serviceId: string; name: string; priceCents: number }[];
};

export type FinancePayment = {
  amountCents: number;
  methodName: string;
  appointmentId: string | null;
  voided: boolean;
};

export type FinanceExpense = { amountCents: number; voided: boolean };

export type FinanceSummary = {
  receivedCents: number;
  expectedCents: number;
  expensesCents: number;
  resultCents: number;
  completedCount: number;
  scheduledCount: number;
  averageTicketCents: number;
  byMethod: { name: string; cents: number }[];
  topServices: { serviceId: string; name: string; count: number; cents: number }[];
};

/**
 * Resumo de um período. Os dados já devem vir filtrados pelo período:
 * agendamentos pela data do atendimento, pagamentos pela data do recebimento
 * e despesas pela data do gasto.
 *
 * - Recebido: só pagamentos efetivos (estornos não contam).
 * - Previsto: valor dos atendimentos confirmados e realizados no período.
 * - Pendências não entram como recebido.
 */
export function summarize(
  appointments: FinanceAppointment[],
  payments: FinancePayment[],
  expenses: FinanceExpense[],
): FinanceSummary {
  const validPayments = payments.filter((p) => !p.voided);
  const receivedCents = sum(validPayments.map((p) => p.amountCents));
  const active = appointments.filter((a) => a.status === "confirmed" || a.status === "completed");
  const completed = appointments.filter((a) => a.status === "completed");
  const expensesCents = sum(expenses.filter((e) => !e.voided).map((e) => e.amountCents));

  const methods = new Map<string, number>();
  for (const p of validPayments) methods.set(p.methodName, (methods.get(p.methodName) ?? 0) + p.amountCents);

  const services = new Map<string, { serviceId: string; name: string; count: number; cents: number }>();
  for (const a of completed) {
    for (const item of a.items) {
      const s = services.get(item.serviceId) ?? { serviceId: item.serviceId, name: item.name, count: 0, cents: 0 };
      s.count += 1;
      s.cents += item.priceCents;
      services.set(item.serviceId, s);
    }
  }

  return {
    receivedCents,
    expectedCents: sum(active.map((a) => a.totalCents)),
    expensesCents,
    resultCents: receivedCents - expensesCents,
    completedCount: completed.length,
    scheduledCount: active.length,
    averageTicketCents: completed.length ? Math.round(sum(completed.map((a) => a.totalCents)) / completed.length) : 0,
    byMethod: [...methods].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents),
    topServices: [...services.values()].sort((a, b) => b.count - a.count || b.cents - a.cents).slice(0, 5),
  };
}

/** Quanto falta receber de cada atendimento realizado. */
export function outstanding(
  appointments: (FinanceAppointment & { startsAt: string })[],
  payments: FinancePayment[],
) {
  const paid = new Map<string, number>();
  for (const p of payments) {
    if (p.voided || !p.appointmentId) continue;
    paid.set(p.appointmentId, (paid.get(p.appointmentId) ?? 0) + p.amountCents);
  }
  return appointments
    .filter((a) => a.status === "completed")
    .map((a) => ({ ...a, paidCents: paid.get(a.id) ?? 0, dueCents: a.totalCents - (paid.get(a.id) ?? 0) }))
    .filter((a) => a.dueCents > 0);
}

export type PeriodKind = "dia" | "semana" | "mes" | "ano";

/** Intervalo [from, to) em datas locais, e o período anterior equivalente para comparação. */
export function periodRange(kind: PeriodKind, anchor: string) {
  switch (kind) {
    case "dia":
      return { from: anchor, to: addDays(anchor, 1), prevFrom: addDays(anchor, -1), prevTo: anchor };
    case "semana": {
      const from = startOfWeek(anchor);
      return { from, to: addDays(from, 7), prevFrom: addDays(from, -7), prevTo: from };
    }
    case "mes": {
      const from = startOfMonth(anchor);
      const to = addDays(from, daysInMonth(from));
      const prevFrom = startOfMonth(addDays(from, -1));
      return { from, to, prevFrom, prevTo: from };
    }
    case "ano": {
      const year = Number(anchor.slice(0, 4));
      return { from: `${year}-01-01`, to: `${year + 1}-01-01`, prevFrom: `${year - 1}-01-01`, prevTo: `${year}-01-01` };
    }
  }
}

/** Variação percentual; null quando não há base de comparação. */
export function percentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}
