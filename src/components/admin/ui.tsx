import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft } from "@/components/ui/icons";

export function PageHeader({
  title,
  back,
  actions,
  description,
  eyebrow,
}: {
  title: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
  description?: ReactNode;
  /** Linha pequena em caixa alta acima do título (ex.: a data de hoje) */
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-5">
      {back && (
        <Link href={back.href} className="-ml-1 mb-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-rose-deep">
          <IconChevronLeft size={18} /> {back.label}
        </Link>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="label-caps text-rose-deep">{eyebrow}</p>}
          <h1 className="font-display text-[26px] leading-[34px] font-semibold text-cocoa sm:text-[32px] sm:leading-10">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="mt-1 text-sm text-cocoa-soft">{description}</p>}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  icon,
  progress,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn" | "brand";
  icon?: ReactNode;
  /** 0 a 1: barra fina de progresso abaixo do número */
  progress?: number;
}) {
  const color = tone === "good" ? "text-sage" : tone === "warn" ? "text-amber" : tone === "brand" ? "text-rose-deep" : "text-cocoa";
  return (
    <div className="flex h-full flex-col rounded-2xl bg-shell p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2 text-cocoa-soft">
        <p className="label-caps">{label}</p>
        {icon && <span className="text-rose">{icon}</span>}
      </div>
      <p className={`mt-2 font-display text-[22px] leading-[30px] font-semibold tabular ${color}`}>{value}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-high" aria-hidden="true">
          <div className="h-full rounded-full bg-rose-deep" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-cocoa-soft">{hint}</p>}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className = "",
  icon,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <section className={`mt-8 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-cocoa">
          {icon && <span className="text-rose-deep">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ListLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-nude-soft/60 ${className}`}>
      {children}
    </Link>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-nude/70 overflow-hidden rounded-2xl bg-shell shadow-soft">{children}</ul>;
}

export const STATUS_LABEL = {
  confirmed: { label: "Confirmado", tone: "sage" },
  completed: { label: "Realizado", tone: "rose" },
  cancelled: { label: "Cancelado", tone: "danger" },
  no_show: { label: "Faltou", tone: "neutral" },
} as const;
