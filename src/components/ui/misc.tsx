import type { ReactNode } from "react";

type Tone = "rose" | "sage" | "amber" | "danger" | "neutral";

const tones: Record<Tone, string> = {
  rose: "bg-petal-soft text-rose-ink",
  sage: "bg-sage-soft text-sage",
  amber: "bg-amber-soft text-amber",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-high text-cocoa-soft",
};

export function Badge({ tone = "rose", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-shell p-4 shadow-soft sm:p-5 ${className}`}>{children}</div>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-low px-5 py-10 text-center">
      <p className="font-display text-xl font-semibold text-cocoa">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-sm text-sm text-cocoa-soft">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Cantoneiras ornamentais, como a moldura da tabela de preços impressa. */
export function OrnamentFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  const corner = (
    <svg viewBox="0 0 60 60" className="size-12 text-antique sm:size-14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M4 56V18c0-8 6-14 14-14h38" />
      <path d="M10 46c0-14 8-26 22-30 6-2 12 2 10 8-2 5-9 5-10 0" opacity="0.8" />
      <path d="M4 18c6 0 10-4 10-10" opacity="0.7" />
      <rect x="1.5" y="27" width="5" height="5" transform="rotate(45 4 29.5)" fill="currentColor" stroke="none" />
      <rect x="27" y="1.5" width="5" height="5" transform="rotate(45 29.5 4)" fill="currentColor" stroke="none" />
    </svg>
  );
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute left-0 top-0">{corner}</div>
      <div className="pointer-events-none absolute right-0 top-0 -scale-x-100">{corner}</div>
      <div className="pointer-events-none absolute bottom-0 left-0 -scale-y-100">{corner}</div>
      <div className="pointer-events-none absolute bottom-0 right-0 -scale-100">{corner}</div>
      {children}
    </div>
  );
}
