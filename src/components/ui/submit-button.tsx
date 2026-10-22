"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Spinner, buttonClass, type ButtonProps } from "./button";

/** Botão de envio de formulário: mantém o texto e mostra o carregamento. */
export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  pending: pendingProp,
  ...props
}: Omit<ButtonProps, "type"> & { children: ReactNode; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button
      type="submit"
      className={buttonClass(variant, size, className)}
      disabled={pending || props.disabled}
      aria-busy={pending}
      {...props}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}
