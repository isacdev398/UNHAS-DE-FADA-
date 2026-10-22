import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "whatsapp";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[0.01em] transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-rose-deep text-white shadow-cta hover:bg-rose-ink",
  secondary: "bg-shell text-rose-deep ring-[1.5px] ring-inset ring-antique/70 hover:bg-champagne",
  soft: "bg-surface-high text-rose-deep hover:bg-rose-deep hover:text-white",
  ghost: "text-rose-deep hover:bg-nude-soft",
  danger: "bg-shell text-danger ring-1 ring-inset ring-danger/30 hover:bg-danger-soft",
  whatsapp: "bg-sage text-white shadow-soft hover:bg-[#186446]",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3.5 text-[13px]",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function LinkButton({ variant = "primary", size = "md", className = "", ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`size-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
