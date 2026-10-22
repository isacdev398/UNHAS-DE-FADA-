"use client";

import { useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ok"; data: T };

/**
 * Carrega dados quando `key` muda. O estado de carregamento é derivado da
 * chave (sem setState síncrono em efeitos) e respostas antigas são ignoradas.
 * `key` null = não carregar.
 */
export function useAsync<T>(key: string | null, load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<{ key: string; data?: T; error?: string } | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    loadRef
      .current()
      .then((data) => !cancelled && setState({ key, data }))
      .catch((e: unknown) => !cancelled && setState({ key, error: e instanceof Error ? e.message : "Não foi possível carregar." }));
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (key === null) return { status: "idle" };
  if (!state || state.key !== key) return { status: "loading" };
  if (state.error !== undefined) return { status: "error", error: state.error };
  return { status: "ok", data: state.data as T };
}
