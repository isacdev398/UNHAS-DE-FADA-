import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "block w-full min-h-13 rounded-xl border border-antique/30 bg-surface-low px-4 text-cocoa placeholder:text-cocoa-soft/50 transition-[border-color,box-shadow,background-color] focus:border-rose-deep focus:bg-white focus:outline-none focus:ring-4 focus:ring-rose/12 aria-[invalid=true]:border-danger";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="label-caps block text-cocoa-soft">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-cocoa-soft">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-[13px] font-medium text-danger" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${inputClass} min-h-24 py-3 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${inputClass} appearance-none pr-10 ${className}`} {...props} />;
}

export function Checkbox({ label, className = "", ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-3 py-2 text-[15px] ${className}`}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-rose-deep" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function FormMessage({ result }: { result?: { ok: boolean; error?: string; message?: string } | null }) {
  if (!result) return null;
  if (!result.ok && result.error) {
    return (
      <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
        {result.error}
      </p>
    );
  }
  if (result.ok && result.message) {
    return (
      <p role="status" className="rounded-xl bg-sage-soft px-4 py-3 text-sm font-medium text-sage">
        {result.message}
      </p>
    );
  }
  return null;
}
