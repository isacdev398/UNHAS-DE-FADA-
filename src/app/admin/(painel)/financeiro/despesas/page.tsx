import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader, Section } from "@/components/admin/ui";
import { getAdminSettings, listExpenses, listPaymentMethods } from "@/lib/data/admin";
import { periodRange } from "@/lib/finance";
import { formatBRL } from "@/lib/format";
import { formatLocalDateShort, formatMonthYear, todayIn } from "@/lib/time";
import { ExpenseForm, VoidExpense } from "./expense-forms";

export const metadata: Metadata = { title: "Despesas" };

export default async function ExpensesPage() {
  await connection();
  const settings = await getAdminSettings();
  const today = todayIn(settings.tz);
  const month = periodRange("mes", today);
  const [expenses, methods] = await Promise.all([listExpenses(periodRange("mes", month.prevFrom).from, month.to), listPaymentMethods()]);
  const total = expenses.filter((e) => !e.voided && e.spentOn >= month.from).reduce((s, e) => s + e.amountCents, 0);

  return (
    <>
      <PageHeader title="Despesas" back={{ href: "/admin/financeiro", label: "Financeiro" }} description={`Total em ${formatMonthYear(today)}: ${formatBRL(total)}`} />
      <ExpenseForm today={today} methods={methods} />
      <Section title="Lançamentos recentes">
        {expenses.length === 0 ? (
          <p className="text-sm text-cocoa-soft">Nenhuma despesa registrada.</p>
        ) : (
          <ul className="divide-y divide-nude/70 rounded-2xl bg-shell shadow-soft">
            {expenses.map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-cocoa-soft tabular">{formatLocalDateShort(e.spentOn)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-medium ${e.voided ? "line-through" : ""}`}>{e.description}</span>
                    <span className="text-cocoa-soft">
                      {e.category}
                      {e.method && ` · ${e.method}`}
                    </span>
                  </span>
                  <span className={`tabular ${e.voided ? "text-cocoa-soft line-through" : "font-medium"}`}>{formatBRL(e.amountCents)}</span>
                </div>
                {e.voided ? <p className="mt-1 text-[13px] text-danger">Estornada: {e.voidReason}</p> : <VoidExpense id={e.id} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
